import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PlayChatPanel } from "@/components/board/play-chat-panel";

describe("PlayChatPanel", () => {
  test("renders player and public chat channels", () => {
    const markup = renderToStaticMarkup(<PlayChatPanel gameStarted={false} isSpectating={false} locale="en" playMode="offline" roomId="mini-shogi-local" title="Mini Shogi" variantKey="mini-shogi" />);

    expect(markup).toContain('aria-label="Mini Shogi chat room"');
    expect(markup).toContain("mini-shogi-local");
    expect(markup).toContain("Players");
    expect(markup).toContain("Public");
    expect(markup).toContain("Private 1v1 room");
    expect(markup).toContain("Player room ready.");
    expect(markup).toContain("Private 1v1 chat.");
    expect(markup).toContain("Message player room");
    expect(markup).not.toContain("Player chat is available in playable rooms");
  });

  test("starts spectators in public chat", () => {
    const markup = renderToStaticMarkup(<PlayChatPanel gameStarted isSpectating locale="en" playMode="spectate" roomId="room-123" title="Classic Chess" variantKey="classic" />);

    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain("/en/watch?q=room-123&amp;variant=classic");
    expect(markup).toContain("Player chat is available in playable rooms");
    expect(markup).toContain("Spectator room");
    expect(markup).toContain("Public room ready.");
    expect(markup).toContain("Everyone watching can join.");
    expect(markup).toContain("Message public room");
  });

  test("links local variant chat to watch with a variant hint", () => {
    const markup = renderToStaticMarkup(<PlayChatPanel gameStarted locale="en" isSpectating={false} playMode="bot" roomId="mini-shogi-local" title="Mini Shogi" variantKey="mini-shogi" />);

    expect(markup).toContain("/en/watch?q=mini-shogi-local&amp;variant=mini-shogi");
  });
});
