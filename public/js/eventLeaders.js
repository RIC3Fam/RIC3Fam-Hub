(function () {
    function initRoleEditor(config) {
        const editor = document.getElementById(config.editorId);
        const addBtn = document.getElementById(config.addBtnId);
        const form = document.getElementById(config.formId);
        if (!editor || !addBtn || !form) return;

        let searchTimer = null;
        const fieldName = config.fieldName;

        function reindexRows() {
            const rows = editor.querySelectorAll('[data-leader-row]');
            rows.forEach((row, index) => {
                const title = row.querySelector('.leader-title');
                const userId = row.querySelector('.leader-user-id');
                if (title) title.name = `${fieldName}[${index}][title]`;
                if (userId) userId.name = `${fieldName}[${index}][userId]`;
            });
        }

        function createRow(titleValue = '', userIdValue = '', labelValue = '') {
            const row = document.createElement('div');
            row.className = 'leader-row';
            row.setAttribute('data-leader-row', '');
            const titleMarkup = config.requireTitle === false ? '' : `
            <label class="form-label">Title
                <input class="form-input leader-title" type="text" maxlength="80" placeholder="${config.titlePlaceholder}" value="">
            </label>`;
            row.innerHTML = `
            ${titleMarkup}
            <label class="form-label">Person
                <input class="form-input leader-search" type="text" placeholder="Type a name or username" autocomplete="off" value="">
                <input type="hidden" class="leader-user-id" value="">
                <ul class="leader-suggestions" hidden></ul>
                <span class="muted leader-selected-note" hidden>Selected profile linked</span>
            </label>
            <button type="button" class="reject-button remove-leader-row">Remove</button>
        `;
            const title = row.querySelector('.leader-title');
            const search = row.querySelector('.leader-search');
            const userId = row.querySelector('.leader-user-id');
            const note = row.querySelector('.leader-selected-note');
            if (title) title.value = titleValue;
            search.value = labelValue;
            userId.value = userIdValue;
            if (userIdValue) note.hidden = false;
            wireRow(row);
            return row;
        }

        function clearSelection(row) {
            row.querySelector('.leader-user-id').value = '';
            const note = row.querySelector('.leader-selected-note');
            if (note) note.hidden = true;
        }

        function setSelection(row, user) {
            const label = `${user.name || user.username} (@${user.username})`;
            row.querySelector('.leader-search').value = label;
            row.querySelector('.leader-user-id').value = user._id;
            const note = row.querySelector('.leader-selected-note');
            if (note) note.hidden = false;
            const list = row.querySelector('.leader-suggestions');
            list.hidden = true;
            list.replaceChildren();
        }

        async function searchUsers(term) {
            const response = await fetch('/search?term=' + encodeURIComponent(term), {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data.users) ? data.users : [];
        }

        function wireRow(row) {
            const search = row.querySelector('.leader-search');
            const list = row.querySelector('.leader-suggestions');
            const removeBtn = row.querySelector('.remove-leader-row');

            removeBtn.addEventListener('click', () => {
                row.remove();
                reindexRows();
            });

            search.addEventListener('input', () => {
                clearSelection(row);
                const term = search.value.trim();
                clearTimeout(searchTimer);
                if (term.length < 1) {
                    list.hidden = true;
                    list.replaceChildren();
                    return;
                }
                searchTimer = setTimeout(async () => {
                    try {
                        const users = await searchUsers(term);
                        list.replaceChildren();
                        if (!users.length) {
                            const empty = document.createElement('li');
                            empty.className = 'muted';
                            empty.textContent = 'No matching profiles';
                            list.appendChild(empty);
                            list.hidden = false;
                            return;
                        }
                        users.slice(0, 8).forEach((user) => {
                            const li = document.createElement('li');
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = 'leader-suggestion-btn';
                            btn.textContent = `${user.name || user.username} (@${user.username})`;
                            btn.addEventListener('click', () => setSelection(row, user));
                            li.appendChild(btn);
                            list.appendChild(li);
                        });
                        list.hidden = false;
                    } catch (err) {
                        list.hidden = true;
                    }
                }, 250);
            });
        }

        editor.querySelectorAll('[data-leader-row]').forEach(wireRow);
        reindexRows();

        addBtn.addEventListener('click', () => {
            editor.appendChild(createRow());
            reindexRows();
        });

        form.addEventListener(
            'submit',
            (event) => {
                const rows = editor.querySelectorAll('[data-leader-row]');
                for (const row of rows) {
                    const titleInput = row.querySelector('.leader-title');
                    const title = titleInput ? titleInput.value.trim() : '';
                    const userId = row.querySelector('.leader-user-id').value.trim();
                    if (!title && !userId) continue;
                    if ((config.requireTitle !== false && !title) || !userId) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        const errorLabel = document.getElementById('error-label');
                        if (errorLabel) {
                            errorLabel.hidden = false;
                            errorLabel.innerHTML = config.incompleteError;
                        }
                        return false;
                    }
                }
                reindexRows();
            },
            true
        );
    }

    initRoleEditor({
        editorId: 'event-leaders-editor',
        addBtnId: 'add-leader-row',
        formId: 'create-game-form',
        fieldName: 'leaders',
        titlePlaceholder: 'e.g. Primary Cook',
        incompleteError: 'Each leader needs a title and a selected profile from search.',
    });

    initRoleEditor({
        editorId: 'group-manual-members-editor',
        addBtnId: 'add-manual-member-row',
        formId: 'create-group-form',
        fieldName: 'manualMembers',
        titlePlaceholder: '',
        incompleteError: 'Each manual member needs a selected profile from search.',
        requireTitle: false,
    });
})();
