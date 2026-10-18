const approvalPage = document.querySelector("[data-approval-page]");

if (approvalPage) {
  const label = approvalPage.querySelector("[data-approval-label]");
  const indicator = approvalPage.querySelector("[data-approval-indicator]");
  const errorMessage = approvalPage.querySelector("[data-approval-error]");
  const retryButton = approvalPage.querySelector("[data-approval-retry]");
  let attempts = 0;
  let stopped = false;
  let timer;

  async function checkStatus() {
    if (stopped) return;
    attempts += 1;
    try {
      const response = await fetch(approvalPage.dataset.statusUrl, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Status belum dapat diperiksa.");
      const result = await response.json();

      if (result.status === "approved" && result.redirect) {
        stopped = true;
        label.textContent = "Disetujui · membuka ruang keuanganmu";
        indicator.classList.add("is-approved");
        window.location.assign(result.redirect);
        return;
      }
      if (result.status === "rejected") {
        stopped = true;
        label.textContent = "Pendaftaran tidak disetujui";
        indicator.classList.add("is-rejected");
        if (result.reason)
          approvalPage.querySelector("[data-approval-message]").textContent =
            `Pendaftaran tidak disetujui. Alasan: ${result.reason}`;
        retryButton.hidden = true;
        return;
      }
      errorMessage.hidden = true;
      retryButton.hidden = true;
    } catch {
      if (attempts >= 20) {
        stopped = true;
        label.textContent = "Status belum dapat diperbarui";
        errorMessage.hidden = false;
        retryButton.hidden = false;
        return;
      }
    }
    timer = window.setTimeout(
      checkStatus,
      Math.min(3000 + attempts * 150, 6000),
    );
  }

  retryButton.addEventListener("click", () => {
    attempts = 0;
    stopped = false;
    errorMessage.hidden = true;
    retryButton.hidden = true;
    checkStatus();
  });
  checkStatus();
}
