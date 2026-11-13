// เชื่อม HTML แต่ละหน้า
export async function mountComponents(root = document) {
  const nodes = [...root.querySelectorAll('[data-include]')];
  await Promise.all(nodes.map(async (el) => {
    const url = el.dataset.include;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`โหลด component ไม่สำเร็จ: ${url} (${res.status})`);
    el.outerHTML = await res.text();
  }));
}
