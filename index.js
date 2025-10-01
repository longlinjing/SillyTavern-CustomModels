import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { getRequestHeaders } from '../../../../script.js';

// API 轮询功能 - 从 ZerxzLib 集成
async function getSecrets() {
    const response = await fetch("/api/secrets/view", {
        method: "POST",
        headers: getRequestHeaders(),
    });

    if (response.status === 403) {
        console.warn("无法访问 API 密钥，请在 config.yaml 中设置 allowKeysExposure 为 true");
        return;
    }

    if (!response.ok) {
        return;
    }

    return await response.json();
}

async function getGeminiModel(key) {
    try {
        const result = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/?key=${key}`,
        );
        const data = await result.json();
        if (!data?.models) {
            return [];
        }
        console.log("获取到的 Gemini 模型:", data);
        return data.models
            .filter((model) => model.name.includes("gemini"))
            .map((modelData) => {
                const model = modelData.name.replace("models/", "");
                const name = modelData.displayName;
                return {
                    name,
                    model,
                };
            });
    } catch (e) {
        console.error("获取 Gemini 模型失败:", e);
        return [];
    }
}

async function saveKey(key, value) {
    try {
        const response = await fetch("/api/secrets/save", {
            method: "POST",
            headers: {
                ...getRequestHeaders(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ [key]: value }),
        });
        
        if (response.ok) {
            console.log(`密钥 ${key} 保存成功`);
        }
    } catch (e) {
        console.error("保存密钥失败:", e);
    }
    saveSettingsDebounced();
}

async function initGeminiModels(secrets = {}) {
    if (!secrets) {
        return;
    }
    
    const modelStr = JSON.parse(secrets.models_makersuite ?? "[]") || [];
    const api_key = secrets.api_key_makersuite ?? "";
    
    if (!api_key) {
        console.log("未找到 Gemini API 密钥");
        return;
    }

    console.log("初始化 Gemini 模型...");
    
    const sel = document.querySelector('#model_google_select');
    if (!sel) {
        console.log("未找到 Google 模型选择器");
        return;
    }

    // 获取现有的 optgroup 元素
    const optgroups = sel.querySelectorAll('optgroup');
    let customOptGroup = null;
    
    // 查找或创建自定义模型组
    for (const optgroup of optgroups) {
        if (optgroup.label === 'Custom Models') {
            customOptGroup = optgroup;
            break;
        }
    }
    
    if (!customOptGroup) {
        customOptGroup = document.createElement('optgroup');
        customOptGroup.label = 'Custom Models';
        sel.appendChild(customOptGroup);
    }

    // 获取现有模型列表
    const existingModels = Array.from(sel.options).map(option => option.value);
    const cachedModels = modelStr.map(model => model.model);

    // 添加缓存的模型
    for (const model of modelStr) {
        if (!existingModels.includes(model.model)) {
            const option = document.createElement('option');
            option.value = model.model;
            option.textContent = `${model.name}(${model.model})`;
            customOptGroup.appendChild(option);
        }
    }

    // 获取新的模型
    const geminiModels = await getGeminiModel(api_key);
    const newModels = geminiModels.filter(
        (model) => !existingModels.includes(model.model) && !cachedModels.includes(model.model)
    );

    if (newModels.length > 0) {
        console.log("发现新的 Gemini 模型:", newModels);
        for (const model of newModels) {
            const option = document.createElement('option');
            option.value = model.model;
            option.textContent = `${model.name}(${model.model})`;
            customOptGroup.appendChild(option);
        }
        
        await saveKey("models_makersuite", JSON.stringify(newModels));
    } else {
        console.log("没有发现新的模型");
    }

    // 设置当前选中的模型
    const allModels = new Set([...existingModels, ...cachedModels, ...newModels.map(model => model.model)]);
    if (secrets.api_key_makersuite_model && allModels.has(secrets.api_key_makersuite_model)) {
        sel.value = secrets.api_key_makersuite_model;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function initApiCallCounter() {
    const originalSend = window.send_message;
    if (originalSend) {
        window.send_message = function(...args) {
            const result = originalSend.apply(this, args);
            
            const currentProvider = document.querySelector('#model_google_select')?.value;
            if (currentProvider) {
                const currentCount = Number(localStorage.getItem("gemini_api_call_count") || 0);
                localStorage.setItem("gemini_api_call_count", (currentCount + 1).toString());
                window.dispatchEvent(new CustomEvent('gemini-api-call-updated'));
            }
            
            return result;
        };
    }
}

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
            let inp;
            const dom = document.createElement('div'); {
                const header = document.createElement('h3'); {
                    header.textContent = `Custom Models: ${provider}`;
                    dom.append(header);
                }
                const hint = document.createElement('small'); {
                    hint.textContent = 'one model name per line';
                    dom.append(hint);
                }
                inp = document.createElement('textarea'); {
                    inp.classList.add('text_pole');
                    inp.rows = 20;
                    inp.value = models.join('\n');
                    dom.append(inp);
                }
            }
            const prom = popupCaller(dom, popupType.TEXT, null, { okButton: 'Save' });
            const result = await prom;
            if (result == popupResult.AFFIRMATIVE) {
                while (models.pop());
                models.push(...inp.value.split('\n').filter(it=>it.length));
                extension_settings.customModels = settings;
                saveSettingsDebounced();
                populateOptGroup();
                if (settings[`${provider}_model`] && models.includes(settings[`${provider}_model`])) {
                    sel.value = settings[`${provider}_model`];
                    sel.dispatchEvent(new Event('change', { bubbles:true }));
                }
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

// 初始化 API 轮询功能
(async function initApiPolling() {
    console.log("初始化 CustomModels API 轮询功能...");
    
    initApiCallCounter();
    
    try {
        const secrets = await getSecrets();
        if (secrets) {
            await initGeminiModels(secrets);
            console.log("API 轮询功能初始化完成");
        } else {
            console.log("无法获取密钥，API 轮询功能初始化失败");
        }
    } catch (error) {
        console.error("API 轮询功能初始化出错:", error);
    }
    
    // 为 Google 提供商添加刷新模型的按钮
    const googleSel = document.querySelector('#model_google_select');
    if (googleSel) {
        const googleH4 = googleSel.parentElement.querySelector('h4');
        if (googleH4) {
            let refreshBtn = googleH4.querySelector('.stcm--refresh-btn');
            if (!refreshBtn) {
                refreshBtn = document.createElement('div');
                refreshBtn.classList.add('stcm--refresh-btn', 'stcm--btn', 'menu_button', 'fa-solid', 'fa-fw', 'fa-refresh');
                refreshBtn.title = '刷新 Gemini 模型列表';
                refreshBtn.addEventListener('click', async () => {
                    refreshBtn.classList.add('loading');
                    try {
                        const secrets = await getSecrets();
                        if (secrets) {
                            await initGeminiModels(secrets);
                            console.log("Gemini 模型列表已刷新");
                        }
                    } catch (error) {
                        console.error("刷新 Gemini 模型列表失败:", error);
                    } finally {
                        refreshBtn.classList.remove('loading');
                    }
                });
                googleH4.appendChild(refreshBtn);
            }
        }
    }
})();
