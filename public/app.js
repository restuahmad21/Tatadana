const transactionForm = document.querySelector("[data-transaction-form]");

if (transactionForm) {
  const typeField = transactionForm.querySelector('[name="type"]');
  const categoryField = transactionForm.querySelector("[data-category-field]");
  const categorySelect = transactionForm.querySelector('[name="category_id"]');
  const destinationField = transactionForm.querySelector(
    "[data-destination-field]",
  );
  const sourceSelect = transactionForm.querySelector('[name="wallet_id"]');
  const destinationSelect = transactionForm.querySelector(
    '[name="to_wallet_id"]',
  );

  function updateTransactionFields() {
    const type = typeField.value;
    const transfer = type === "transfer";
    categoryField.hidden = transfer;
    categorySelect.disabled = transfer;
    destinationField.hidden = !transfer;
    destinationSelect.required = transfer;
    for (const option of categorySelect.options) {
      option.hidden = option.dataset.type !== type;
      option.disabled = option.hidden;
    }
    if (
      type !== "transfer" &&
      [...categorySelect.options].some((option) => option.dataset.type === type)
    ) {
      categorySelect.value = [...categorySelect.options].find(
        (option) => option.dataset.type === type,
      ).value;
    }
    for (const option of destinationSelect.options) {
      option.disabled = option.value === sourceSelect.value;
    }
    if (destinationSelect.selectedOptions[0]?.disabled) {
      const available = [...destinationSelect.options].find(
        (option) => !option.disabled,
      );
      if (available) destinationSelect.value = available.value;
    }
  }

  typeField.addEventListener("change", updateTransactionFields);
  sourceSelect.addEventListener("change", updateTransactionFields);
  updateTransactionFields();
}

const walletForm = document.querySelector("[data-wallet-form]");

if (walletForm) {
  const walletType = walletForm.querySelector("[data-wallet-type]");
  const institutionFields = [
    ...walletForm.querySelectorAll("[data-institution-field]"),
  ];

  function updateWalletFields() {
    for (const field of institutionFields) {
      const active = field.dataset.institutionField === walletType.value;
      field.hidden = !active;
      const select = field.querySelector("select");
      select.disabled = !active;
      select.required = active;
    }
  }

  walletType.addEventListener("change", updateWalletFields);
  updateWalletFields();
}
