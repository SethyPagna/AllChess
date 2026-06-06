import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PlayChatPanel } from "@/components/board/play-chat-panel";

describe("PlayChatPanel", () => {
  test("renders player and public chat channels", () => {
    const markup = renderToStaticMarkup(<PlayChatPanel gameStarted={false} isSpectating={false} playMode="offline" title="Mini Shogi" />);

    expect(markup).toContain('aria-label="Mini Shogi chat room"');
    expect(markup).toContain("Players");
    expect(markup).toContain("Public");
    expect(markup).toContain("Player chat ready.");
    expect(markup).toContain("Message player room");
  });

  test("starts spectators in public chat", () => {
    const markup = renderToStaticMarkup(<PlayChatPanel gameStarted isSpectating playMode="spectate" title="Classic Chess" />);

    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain("Public chat ready.");
    expect(markup).toContain("Message public room");
  });
});
