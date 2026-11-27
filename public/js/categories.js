const categoryForm = document.getElementById('category-form');

// Sends a change to the server, shows the result and reloads the lists
async function changeCategory(url, method, body) {
  try {
    const data = await apiRequest(url, { method, body: body && JSON.stringify(body) });
    showMessage('message', data.message, 'success');
    await loadCategories();
    return true;
  } catch (error) {
    showMessage('message', error.message);
    return false;
  }
}

function createCategoryItem(category) {
  const url = `/api/categories/${category.id}`;
  const item = createElement('li', '', category.isArchived ? 'archived' : '');
  const label = category.isArchived ? `${category.name} (archived)` : category.name;
  const buttons = createElement('span', '', 'row-actions');

  buttons.append(
    createButton('Rename', 'button-secondary', () => {
      const name = window.prompt('New category name:', category.name);
      if (name !== null) changeCategory(url, 'PATCH', { name });
    }),
    createButton(category.isArchived ? 'Restore' : 'Archive', 'button-secondary', () => {
      changeCategory(url, 'PATCH', { isArchived: !category.isArchived });
    })
  );

  // Only categories that no transaction uses can be deleted permanently
  if (category.transactionCount === 0) {
    buttons.append(
      createButton('Delete', 'button-danger', () => {
        if (window.confirm(`Permanently delete "${category.name}"? Any budgets for it are deleted too.`)) {
          changeCategory(url, 'DELETE');
        }
      })
    );
  }

  item.append(createElement('span', label, 'category-name'), buttons);
  return item;
}

async function loadCategories() {
  try {
    const { categories } = await apiRequest('/api/categories');

    for (const type of ['expense', 'income']) {
      const items = categories.filter((c) => c.type === type).map(createCategoryItem);
      if (items.length === 0) items.push(createElement('li', 'No categories.', 'muted'));
      document.getElementById(`${type}-categories`).replaceChildren(...items);
    }
  } catch (error) {
    showMessage('message', error.message);
  }
}

categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(categoryForm));

  if (await changeCategory('/api/categories', 'POST', body)) {
    categoryForm.elements.name.value = '';
  }
});

loadCategories();
