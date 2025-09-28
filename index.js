import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const settings = {
    provider: {
        claude: [],
        openai: [],
        google: [],
    },
    openai_model: undefined,
    claude_model: undefined,
    google_model: undefined,
};
Object.assign(settings, extension_settings.customModels ?? {});
// fix if installed before google support was added
if (!settings.provider.google) settings.provider.google = [];
if (!settings.google_model) settings.google_model = undefined;

// old popups, ancient ST
let popupCaller;
let popupType;
let popupResult;
try {
    const popup = await import('../../../popup.js');
    popupCaller = popup.callGenericPopup;
    popupType = popup.POPUP_TYPE;
    popupResult = popup.POPUP_RESULT;
} catch {
    popupCaller = (await import('../../../../script.js')).callPopup;
    popupType = {
        TEXT: 1,
    };
    popupResult = {
        AFFIRMATIVE: 1,
    };
}

for (const [provider, models] of Object.entries(settings.provider)) {
    const sel = /**@type {HTMLSelectElement}*/(document.querySelector(`#model_${provider}_select`));
    const h4 = sel.parentElement.querySelector('h4');
    const btn = document.createElement('div'); {
        btn.classList.add('stcm--btn');
        btn.classList.add('menu_button');
        btn.classList.add('fa-solid', 'fa-fw', 'fa-pen-to-square');
        btn.title = 'Edit custom models';
btn.addEventListener('click', async()=>{
            const dom = document.createElement('div');
            const modelList = document.createElement('div');
            modelList.id = 'stcm--model-list';

            const renderModels = () => {
                modelList.innerHTML = '';
                models.forEach(model => {
                    const item = document.createElement('div');
                    item.classList.add('stcm--model-item');
                    const name = document.createElement('span');
                    name.textContent = model;
                    const delBtn = document.createElement('div');
                    delBtn.classList.add('stcm--delete-btn', 'fa-solid', 'fa-trash', 'fa-fw');
                    delBtn.title = 'Delete model';
                    delBtn.addEventListener('click', () => {
                        const index = models.indexOf(model);
                        if (index > -1) {
                            models.splice(index, 1);
                        }
                        renderModels(); // Re-render the list
                    });
                    item.append(name, delBtn);
                    modelList.append(item);
                });
            };

            const header = document.createElement('h3');
            header.textContent = `Custom Models: ${provider}`;
            dom.append(header);

            renderModels();
            dom.append(modelList);

            const addContainer = document.createElement('div');
            addContainer.classList.add('stcm--add-container');
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.classList.add('text_pole');
            inp.placeholder = 'Add new model...';
            const addBtn = document.createElement('div');
            addBtn.classList.add('stcm--add-btn', 'menu_button');
            addBtn.textContent = 'Add';
            addBtn.addEventListener('click', () => {
                const newModel = inp.value.trim();
                if (newModel && !models.includes(newModel)) {
                    models.push(newModel);
                    renderModels(); // Re-render
                    inp.value = '';
                }
            });
            inp.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') {
                    addBtn.click();
                }
            });
            addContainer.append(inp, addBtn);
            dom.append(addContainer);

            const prom = popupCaller(dom, popupType.TEXT, null, { okButton: 'Save' });
            const result = await prom;
            if (result == popupResult.AFFIRMATIVE) {
                // The 'models' array is already updated by the add/delete actions
                extension_settings.customModels = settings;
                saveSettingsDebounced();
                populateOptGroup();
                if (settings[`${provider}_model`] && models.includes(settings[`${provider}_model`])) {
                    sel.value = settings[`${provider}_model`];
                } else if (!models.includes(sel.value)) {
                    // If the currently selected model was deleted, reset to default
                    sel.selectedIndex = 0;
                }
                sel.dispatchEvent(new Event('change', { bubbles:true }));
            }
        });
        h4.append(btn);
    }
    const populateOptGroup = ()=>{
        grp.innerHTML = '';
        for (const model of models) {
            const opt = document.createElement('option'); {
                opt.value = model;
                opt.textContent = model;
                grp.append(opt);
            }
        }
    };
    const grp = document.createElement('optgroup'); {
        grp.label = 'Custom Models';
        populateOptGroup();
        sel.insertBefore(grp, sel.children[0]);
    }
    if (settings[`${provider}_model`] && models.includes(settings[`${provider}_model`])) {
        sel.value = settings[`${provider}_model`];
        sel.dispatchEvent(new Event('change', { bubbles:true }));
    }
    sel.addEventListener('change', (evt)=>{
        evt.stopImmediatePropagation();
        if (settings[`${provider}_model`] != sel.value) {
            settings[`${provider}_model`] = sel.value;
            extension_settings.customModels = settings;
            saveSettingsDebounced();
        }
    });
}
