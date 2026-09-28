import { createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { PlayControlCard } from "@/components/board/play-control-card";

type Props = ComponentProps<typeof PlayControlCard>;
type ElementProps = { "aria-label"?: string; "aria-pressed"?: boolean; children?: ReactNode; className?: string; disabled?: boolean; onClick?: () => void };

function createProps(overrides: Partial<Props> = {}): Props {
  return {
    botMode: "human",
    canEndGame: true,
    canRedo: true,
    canUndo: true,
    canUseAssist: true,
    canUseBots: true,
    isThinking: false,
    suggestedMoveReady: false,
    onApplySuggestion: vi.fn(),
    onCancelThinking: vi.fn(),
    onExport: vi.fn(),
    onMoveForCurrentSide: vi.fn(),
    onOfferDraw: vi.fn(),
    onRedo: vi.fn(),
    onResign: vi.fn(),
    onReset: vi.fn(),
    onSuggest: vi.fn(),
    onToggleAuto: vi.fn(),
    onToggleBot: vi.fn(),
    onTogglePause: vi.fn(),
    onUndo: vi.fn(),
    ...overrides
  };
}

/** Renders the card on the server and keeps the element tree so handlers can be invoked without a DOM. */
function renderCard(props: Props) {
  const renderControls = PlayControlCard as (props: Props) => ReactElement;
  let tree: ReactElement | null = null;
  const host = () => (tree = renderControls(props));
  const markup = renderToStaticMarkup(createElement(host));
  const buttons = collect(tree, (element) => element.type === "button" || element.type === "summary");
  const button = (name: string) => {
    const match = buttons.find((element) => accessibleName(element) === name);
    if (!match) throw new Error(`No control named "${name}" in: ${buttons.map(accessibleName).join(", ")}`);
    return match.props;
  };
  const menu = collect(tree, (element) => element.props.className?.includes("play-more-menu") ?? false)[0];
  const menuItems = collect(menu, (element) => element.type === "button").map(accessibleName);
  return { button, markup, menuItems, names: buttons.map(accessibleName) };
}

function collect(node: ReactNode, match: (element: ReactElement<ElementProps>) => boolean, found: ReactElement<ElementProps>[] = []) {
  if (Array.isArray(node)) node.forEach((child) => collect(child, match, found));
  else if (isValidElement<ElementProps>(node)) {
    if (match(node)) found.push(node);
    collect(node.props.children, match, found);
  }
  return found;
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return isValidElement<ElementProps>(node) ? textOf(node.props.children) : "";
}

function accessibleName(element: ReactElement<ElementProps>) {
  return element.props["aria-label"] ?? textOf(element.props.children);
}

describe("PlayControlCard", () => {
  test("renders the compact action bar with the overflow menu", () => {
    const { markup, menuItems, names } = renderCard(createProps());

    expect(markup).toMatch(/^<div class="play-actions" aria-label="Board controls">/);
    expect(names.slice(0, 5)).toEqual(["Undo", "Suggest a move", "Draw", "Resign", "More game actions"]);
    // Label in name: each visible label is part of its control's accessible name.
    for (const [visible, name] of [["Undo", "Undo"], ["Suggest", "Suggest a move"], ["Draw", "Draw"], ["Resign", "Resign"], ["More", "More game actions"]]) {
      expect(markup).toContain(`<span>${visible}</span>`);
      expect(name.toLowerCase()).toContain(visible.toLowerCase());
    }
    expect(markup).not.toContain('aria-label="Undo"');
    expect(markup).toContain('<details class="play-more">');
    expect(menuItems).toEqual(["Redo", "Move for me", "Bot opponent", "Auto · bots play both sides", "Pause game", "Export game", "New game"]);
  });

  test("everyday actions call their handlers", () => {
    const props = createProps();
    const { button } = renderCard(props);

    button("Undo").onClick?.();
    button("Suggest a move").onClick?.();
    button("Draw").onClick?.();
    button("Resign").onClick?.();

    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(props.onSuggest).toHaveBeenCalledTimes(1);
    expect(props.onApplySuggestion).not.toHaveBeenCalled();
    expect(props.onOfferDraw).toHaveBeenCalledTimes(1);
    expect(props.onResign).toHaveBeenCalledTimes(1);
  });

  test("disables actions that are not available yet", () => {
    const { button, markup } = renderCard(createProps({ canEndGame: false, canRedo: false, canUndo: false, canUseAssist: false, canUseBots: false, botMode: "opponent" }));

    expect(button("Undo").disabled).toBe(true);
    expect(button("Suggest a move").disabled).toBe(true);
    expect(button("Draw").disabled).toBe(true);
    expect(button("Resign").disabled).toBe(true);
    expect(button("Redo").disabled).toBe(true);
    expect(button("Move for me").disabled).toBe(true);
    // The active bot mode (default: opponent) stays switchable off; turning another mode on is blocked.
    expect(button("Bot opponent").disabled).toBe(false);
    expect(button("Auto · bots play both sides").disabled).toBe(true);
    expect(button("New game").disabled).toBeFalsy();
    expect(button("More game actions").disabled).toBeUndefined();
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*<span>Undo<\/span><\/button>/);
  });

  test("swaps Undo for Stop while the bot is thinking", () => {
    const props = createProps({ canUndo: false, isThinking: true });
    const { button, names } = renderCard(props);

    expect(names).not.toContain("Undo");
    expect(button("Stop bot thinking").disabled).toBeUndefined();
    button("Stop bot thinking").onClick?.();
    expect(props.onCancelThinking).toHaveBeenCalledTimes(1);
    expect(props.onUndo).not.toHaveBeenCalled();
  });

  test("turns Suggest into Play once a suggestion is ready", () => {
    const props = createProps({ suggestedMoveReady: true });
    const { button, markup, names } = renderCard(props);

    expect(names).not.toContain("Suggest a move");
    expect(button("Play suggested move").className).toContain("is-primary");
    expect(markup).toContain("<span>Play</span>");
    expect(markup).not.toContain("<span>Suggest</span>");
    button("Play suggested move").onClick?.();
    expect(props.onApplySuggestion).toHaveBeenCalledTimes(1);
    expect(props.onSuggest).not.toHaveBeenCalled();
  });

  test("overflow items call their handlers", () => {
    const props = createProps();
    const { button } = renderCard(props);

    for (const name of ["Redo", "Move for me", "Bot opponent", "Auto · bots play both sides", "Pause game", "Export game", "New game"]) button(name).onClick?.();

    expect(props.onRedo).toHaveBeenCalledTimes(1);
    expect(props.onMoveForCurrentSide).toHaveBeenCalledTimes(1);
    expect(props.onToggleBot).toHaveBeenCalledTimes(1);
    expect(props.onToggleAuto).toHaveBeenCalledTimes(1);
    expect(props.onTogglePause).toHaveBeenCalledTimes(1);
    expect(props.onExport).toHaveBeenCalledTimes(1);
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  test("reflects the bot mode on the bot toggles", () => {
    expect(renderCard(createProps({ botMode: "opponent" })).button("Bot opponent")["aria-pressed"]).toBe(true);
    expect(renderCard(createProps({ botMode: "opponent" })).button("Auto · bots play both sides")["aria-pressed"]).toBe(false);
    expect(renderCard(createProps({ botMode: "both" })).button("Auto · bots play both sides")["aria-pressed"]).toBe(true);
  });

  test("keeps the active bot mode switchable off while bots are busy", () => {
    const auto = renderCard(createProps({ botMode: "both", canUseBots: false, isThinking: true }));
    expect(auto.button("Auto · bots play both sides").disabled).toBe(false);
    expect(auto.button("Bot opponent").disabled).toBe(true);
  });

  test("hides bot items when bots are unavailable and nobody is a bot", () => {
    const { menuItems } = renderCard(createProps({ botMode: "human", canUseBots: false }));

    expect(menuItems).not.toContain("Bot opponent");
    expect(menuItems).not.toContain("Auto · bots play both sides");
    expect(menuItems).toContain("Move for me");
  });

  test("keeps bot items visible while a bot mode is still on", () => {
    const { menuItems } = renderCard(createProps({ botMode: "both", canUseBots: false }));

    expect(menuItems).toContain("Bot opponent");
    expect(menuItems).toContain("Auto · bots play both sides");
  });

  test("toggles the pause label and omits optional items without handlers", () => {
    expect(renderCard(createProps({ paused: false })).menuItems).toContain("Pause game");
    expect(renderCard(createProps({ paused: true })).menuItems).toContain("Resume game");
    expect(renderCard(createProps({ paused: true })).menuItems).not.toContain("Pause game");

    const { menuItems } = renderCard(createProps({ onExport: undefined, onTogglePause: undefined }));
    expect(menuItems).not.toContain("Pause game");
    expect(menuItems).not.toContain("Resume game");
    expect(menuItems).not.toContain("Export game");
    expect(menuItems.at(-1)).toBe("New game");
  });

  test("Janggi keeps Pass in the compact bar and Draw in More", () => {
    const onPass = vi.fn();
    const { names, button, menuItems } = renderCard(createProps({ onPass, canPass: true }));
    expect(names.slice(0, 5)).toEqual(["Undo", "Suggest a move", "Pass turn", "Resign", "More game actions"]);
    expect(menuItems).toContain("Draw");
    expect(button("Pass turn").disabled).toBe(false);
    button("Pass turn").onClick?.();
    expect(onPass).toHaveBeenCalledOnce();
    expect(renderCard(createProps({ onPass, canPass: false })).button("Pass turn").disabled).toBe(true);
    expect(renderCard(createProps()).names).not.toContain("Pass turn");
  });
});
