import { createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { PlayMoveList, type PlayMoveListEntry } from "@/components/board/play-move-list";

type Props = ComponentProps<typeof PlayMoveList>;
type ElementProps = { "aria-label"?: string; children?: ReactNode; disabled?: boolean; onClick?: () => void };

const moves: PlayMoveListEntry[] = ["e4", "e5", "Nf3"].map((text, index) => ({ ply: index + 1, text, pieceLabel: text.startsWith("N") ? "Knight" : "Pawn", piece: null }));

function createProps(overrides: Partial<Props> = {}): Props {
  return {
    entries: moves,
    activePly: moves.length,
    reviewing: false,
    playing: false,
    locale: "en",
    pieceSkin: "default",
    variantKey: "classic",
    onSelect: vi.fn(),
    onLive: vi.fn(),
    onTogglePlay: vi.fn(),
    ...overrides
  };
}

/** Renders the list on the server and keeps the element tree so handlers can be invoked without a DOM. */
function renderList(props: Props) {
  const renderMoves = PlayMoveList as (props: Props) => ReactElement;
  let tree: ReactElement | null = null;
  const host = () => (tree = renderMoves(props));
  const markup = renderToStaticMarkup(createElement(host));
  const buttons = collect(tree).filter((element) => element.type === "button");
  const button = (label: string) => {
    const match = buttons.find((element) => element.props["aria-label"] === label);
    if (!match) throw new Error(`No button labelled "${label}"`);
    return match.props;
  };
  return { button, markup };
}

function collect(node: ReactNode, found: ReactElement<ElementProps>[] = []) {
  if (Array.isArray(node)) node.forEach((child) => collect(child, found));
  else if (isValidElement<ElementProps>(node)) {
    found.push(node);
    collect(node.props.children, found);
  }
  return found;
}

function rows(markup: string) {
  return [...markup.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(([, row]) => [...row.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map(([, text]) => text));
}

const controls = ["First move", "Previous move", "Play review", "Next move", "Last move"] as const;

describe("PlayMoveList", () => {
  test("pairs plies into numbered rows", () => {
    const { markup } = renderList(createProps());

    expect(rows(markup)).toEqual([["1", "e4", "e5"], ["2", "Nf3"]]);
    expect(markup).toContain('aria-label="Move 1: Pawn e4"');
    expect(markup).toContain('aria-label="Move 3: Knight Nf3"');
  });

  test("shows an empty state with every playback control disabled", () => {
    const { button, markup } = renderList(createProps({ entries: [], activePly: 0 }));

    expect(markup).toContain("No moves yet");
    expect(markup).not.toContain("<ol");
    for (const label of controls) expect(button(label).disabled).toBe(true);
  });

  test("while live, highlights the latest move and only allows stepping back", () => {
    const props = createProps();
    const { button, markup } = renderList(props);

    expect(markup).not.toContain("aria-current");
    expect(markup.match(/data-latest="true"/g)).toHaveLength(1);
    expect(markup).toMatch(/data-latest="true" aria-label="Move 3: Knight Nf3"/);
    expect(button("First move").disabled).toBe(false);
    expect(button("Previous move").disabled).toBe(false);
    expect(button("Play review").disabled).toBe(false);
    expect(button("Next move").disabled).toBe(true);
    expect(button("Last move").disabled).toBe(true);

    button("Previous move").onClick?.();
    button("First move").onClick?.();
    expect(props.onSelect).toHaveBeenNthCalledWith(1, 2);
    expect(props.onSelect).toHaveBeenNthCalledWith(2, 0);
    expect(props.onLive).not.toHaveBeenCalled();
  });

  test("while reviewing, marks the reviewed move as current", () => {
    const { markup } = renderList(createProps({ activePly: 2, reviewing: true }));

    expect(markup.match(/aria-current="true"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-current="true" aria-label="Move 2: Pawn e5"/);
    expect(markup).not.toContain("data-latest");
  });

  test("while reviewing, steps through plies and returns live from the last one", () => {
    const props = createProps({ activePly: 1, reviewing: true });
    const { button } = renderList(props);

    for (const label of controls) expect(button(label).disabled).toBe(false);
    button("Next move").onClick?.();
    button("Previous move").onClick?.();
    button("Last move").onClick?.();

    expect(props.onSelect).toHaveBeenNthCalledWith(1, 2);
    expect(props.onSelect).toHaveBeenNthCalledWith(2, 0);
    expect(props.onLive).toHaveBeenCalledTimes(1);
  });

  test("stepping forward onto the final ply goes live instead of reviewing it", () => {
    const props = createProps({ activePly: 2, reviewing: true });
    renderList(props).button("Next move").onClick?.();

    expect(props.onLive).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  test("at the start position, first and previous are disabled", () => {
    const { button } = renderList(createProps({ activePly: 0, reviewing: true }));

    expect(button("First move").disabled).toBe(true);
    expect(button("Previous move").disabled).toBe(true);
    expect(button("Next move").disabled).toBe(false);
    expect(button("Last move").disabled).toBe(false);
  });

  test("selecting a move reviews it, while selecting the last ply calls onLive", () => {
    const props = createProps({ activePly: 1, reviewing: true });
    const { button } = renderList(props);

    button("Move 2: Pawn e5").onClick?.();
    expect(props.onSelect).toHaveBeenCalledWith(2);
    expect(props.onLive).not.toHaveBeenCalled();

    button("Move 3: Knight Nf3").onClick?.();
    expect(props.onLive).toHaveBeenCalledTimes(1);
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  test("labels the playback toggle by state and forwards clicks", () => {
    const props = createProps({ playing: true, activePly: 1, reviewing: true });
    const { button, markup } = renderList(props);

    expect(markup).toContain('aria-label="Pause review"');
    expect(markup).not.toContain('aria-label="Play review"');
    button("Pause review").onClick?.();
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
  });
});
