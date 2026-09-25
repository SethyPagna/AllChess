import { runQuickMatch } from "@/lib/realtime/quick-match-runtime";
export async function POST(request: Request) { return runQuickMatch(request, "leave"); }
