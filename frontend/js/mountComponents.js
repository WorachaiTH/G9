// เชื่อม HTML แต่ละหน้า
export async function mountComponents(root = document) {
  let nodes = [...root.querySelectorAll('[data-include]')];
  while (nodes.length) {
    await Promise.all(nodes.map(async (el) => {
      const url = el.dataset.include;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`โหลด component ไม่สำเร็จ: ${url} (${res.status})`);
      el.outerHTML = await res.text();
    }));
    nodes = [...root.querySelectorAll('[data-include]')];
  }
}
