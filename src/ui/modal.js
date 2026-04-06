const overlay = document.getElementById('modal-overlay');
const title = document.getElementById('modal-title');
const body = document.getElementById('modal-body');
const btnConfirm = document.getElementById('modal-confirm');
const btnCancel = document.getElementById('modal-cancel');
export function showConfirm(opts) {
    title.textContent = opts.title;
    body.innerHTML = opts.body;
    overlay.classList.remove('hidden');
    const cleanup = () => {
        overlay.classList.add('hidden');
        btnConfirm.replaceWith(btnConfirm.cloneNode(true));
        btnCancel.replaceWith(btnCancel.cloneNode(true));
    };
    document.getElementById('modal-confirm').addEventListener('click', () => {
        cleanup();
        opts.onConfirm();
    }, { once: true });
    document.getElementById('modal-cancel').addEventListener('click', () => {
        cleanup();
        opts.onCancel?.();
    }, { once: true });
}
