/** Preserve bookmarks while all teaching now lives in the original course nodes. */
export function researchDestination(url) {
  const u = new URL(url, "https://atlas.invalid/");
  const routes = {
    linear: ["linear-state", "state"],
    compiler: ["compiler-lowering", "capture"],
    scheduler: ["vllm-scheduler", "requests"],
    moe: ["moe-route", "router"],
    attention: ["attention-tiling", "scores"],
    flash: ["attention-tiling", "scores"],
    vla: ["vla-policy", "contract"],
  };
  const [topic, chapter] =
    routes[u.searchParams.get("topic")] ||
    (u.pathname.includes("expansion") ? routes.scheduler : routes.linear);
  return `./index.html#depth/${topic}/L2/${chapter}`;
}
if (typeof window !== "undefined")
  window.location.replace(researchDestination(window.location.href));
