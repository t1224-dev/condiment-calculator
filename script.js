// グローバル変数
let recipes = {};
let currentRecipe = null;
let ingredientCounter = 0;
let shouldFocusNewIngredient = false;

// ページの読み込み完了時に実行
document.addEventListener('DOMContentLoaded', () => {
    // レシピデータを読み込む
    fetchRecipes();
    
    // 検索フィルターの変更イベントを監視
    document.getElementById('cuisine-filter').addEventListener('change', filterRecipes);
    document.getElementById('recipe-search').addEventListener('input', filterRecipes);
});

// レシピデータをfetch
async function fetchRecipes() {
    try {
        const response = await fetch('recipes.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        recipes = processRecipeData(data);
        
        // レシピタブを生成
        generateRecipeTabs();
        
        // 最初のレシピを選択
        const firstRecipeKey = Object.keys(recipes)[0];
        if (firstRecipeKey) {
            selectRecipe(firstRecipeKey);
        }
        
        // ページの一番上にスクロール
        window.scrollTo(0, 0);
    } catch (error) {
        console.error('レシピの読み込みに失敗しました:', error);
        document.getElementById('recipe-tabs-container').innerHTML = 
            '<div class="error">レシピの読み込みに失敗しました。ページを再読み込みしてください。</div>';
    }
}

    // 数式文字列を関数に変換
function createFormulaFunction(formulaStr) {
    // 特別な固定値構文をチェック
    if (formulaStr.startsWith('固定値:')) {
        const fixedValue = parseFloat(formulaStr.split(':')[1]);
        return () => fixedValue.toFixed(1);
    }
    
    // 通常の数式を関数化
    return new Function('total', 'soy', 'miso', 'sugar', 'sake', 'mirin', 'ginger', 'garlic', 'weight', `
        try {
            const result = ${formulaStr};
            if (isNaN(result)) {
                console.error('計算結果がNaNです', { formula: '${formulaStr}', arguments: arguments });
                return '0.0';
            }
            return result.toFixed(1);
        } catch (e) {
            console.error('数式の計算エラー:', e, { formula: '${formulaStr}' });
            return '0.0';
        }
    `);
}

// 塩分情報の表示を生成する関数
function createSaltInfoFunction(defaultInfo, formulaStr) {
    // 計算塩分濃度を表示しない、デフォルト情報のみを返す
    return () => defaultInfo;
}

// 読み込んだレシピデータを処理して、文字列の数式を関数に変換します
function processRecipeData(recipeData) {
    const processedRecipes = {};
    
    Object.keys(recipeData).forEach(recipeKey => {
        const recipe = recipeData[recipeKey];
        const processedRecipe = {
            ...recipe,
            condiments: recipe.condiments.map(condiment => {
                // isFixedTextフラグがない場合のみ数式を関数に変換
                if (condiment.formula && typeof condiment.formula === 'string' && !condiment.isFixedText) {
                    condiment.formula = createFormulaFunction(condiment.formula);
                }
                return condiment;
            }),
            // 塩分濃度計算用の関数を生成
            saltInfo: createSaltInfoFunction(recipe.defaultSaltInfo, recipe.saltFormula)
        };
        
        processedRecipes[recipeKey] = processedRecipe;
    });
    
    return processedRecipes;
}

// レシピタブを生成
function generateRecipeTabs() {
    const tabsContainer = document.getElementById('recipe-tabs-container');
    tabsContainer.innerHTML = '';
    
    // 表示するレシピをフィルタリング
    const filteredRecipes = filterRecipesByCurrentSettings();
    
    // タブを生成
    Object.keys(filteredRecipes).forEach(recipeKey => {
        const recipe = filteredRecipes[recipeKey];
        const tabElement = document.createElement('div');
        tabElement.className = 'recipe-tab';
        tabElement.dataset.key = recipeKey;
        
        // 料理ジャンルタグを追加
        tabElement.innerHTML = `
            ${recipe.name}
            <span class="cuisine-tag ${recipe.cuisine}">${getCuisineLabel(recipe.cuisine)}</span>
        `;
        
        // タブのクリックイベント
        tabElement.addEventListener('click', () => {
            selectRecipe(recipeKey);
        });
        
        tabsContainer.appendChild(tabElement);
    });
    
    // タブがない場合のメッセージ
    if (Object.keys(filteredRecipes).length === 0) {
        tabsContainer.innerHTML = '<div class="no-recipes">条件に一致するレシピがありません</div>';
    }
}

// 現在の設定に基づいてレシピをフィルタリング
function filterRecipesByCurrentSettings() {
    const cuisineFilter = document.getElementById('cuisine-filter').value;
    const searchTerm = document.getElementById('recipe-search').value.toLowerCase();
    
    return Object.keys(recipes).reduce((filtered, key) => {
        const recipe = recipes[key];
        const matchesCuisine = cuisineFilter === 'all' || recipe.cuisine === cuisineFilter;
        const matchesSearch = recipe.name.toLowerCase().includes(searchTerm);
        
        if (matchesCuisine && matchesSearch) {
            filtered[key] = recipe;
        }
        return filtered;
    }, {});
}

// レシピフィルターの変更時に呼び出される
function filterRecipes() {
    generateRecipeTabs();
    
    // 現在選択されているレシピがフィルター後も存在するか確認
    const filteredRecipes = filterRecipesByCurrentSettings();
    if (currentRecipe && !filteredRecipes[currentRecipe]) {
        // 現在のレシピがフィルター後に存在しない場合、最初のレシピを選択
        const firstRecipeKey = Object.keys(filteredRecipes)[0];
        if (firstRecipeKey) {
            selectRecipe(firstRecipeKey);
        } else {
            // フィルターに一致するレシピがない場合はカードを非表示に
            document.getElementById('main-card-container').innerHTML = '';
            document.getElementById('result-card-container').innerHTML = '';
        }
    }
}

// 料理ジャンルのラベルを取得
function getCuisineLabel(cuisine) {
    const labels = {
        'japanese': '和風',
        'western': '洋風',
        'chinese': '中華風',
        'korean': '韓国風',
        'other': 'その他'
    };
    return labels[cuisine] || cuisine;
}

// レシピを選択
function selectRecipe(recipeKey) {
    currentRecipe = recipeKey;
    
    // タブの選択状態を更新
    document.querySelectorAll('.recipe-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.key === recipeKey);
    });
    
    // メインカードを生成
    generateMainCard(recipes[recipeKey]);
    
    // 結果カードを生成
    generateResultCard(recipes[recipeKey]);
    
    // ページの一番上にスクロール
    window.scrollTo(0, 0);
}

// メインカードを生成
function generateMainCard(recipe) {
    const mainCardContainer = document.getElementById('main-card-container');
    
    mainCardContainer.innerHTML = `
        <div class="card">
            <div class="card-title">
                <h2>${recipe.name}の調味料計算</h2>
                <div class="actions">
                    <button id="add-ingredient" class="secondary small">
                        <span>材料追加</span>
                    </button>
                    <button id="calculate-button" class="small">
                        <span>計算する</span>
                    </button>
                </div>
            </div>
            
            
            <div class="ingredient-list">
                <!-- 材料は動的に追加されます -->
            </div>
        </div>
    `;
    
    // 材料追加ボタンのイベント
    document.getElementById('add-ingredient').addEventListener('click', () => {
        shouldFocusNewIngredient = true;
        addIngredient();
        shouldFocusNewIngredient = false;
    });
    
    // 計算ボタンのイベント
    document.getElementById('calculate-button').addEventListener('click', calculateCondiments);
    
    // 最初の材料入力フィールドを追加
    addIngredient();
}

// 結果カードを生成
function generateResultCard(recipe) {
    const resultCardContainer = document.getElementById('result-card-container');
    
    resultCardContainer.innerHTML = `
        <div class="card result-card">
            <h2>計算結果</h2>
            <div class="result-list">
                <div class="result-item">
                    <span>材料総重量:</span>
                    <span>0.0 g</span>
                </div>
                ${recipe.condiments.map(c => `
                    <div class="result-item">
                        <span>${c.name}:</span>
                        <span>0.0 ${c.unit || ''}</span>
                    </div>
                `).join('')}
            </div>
            <div class="info-text">${recipe.defaultSaltInfo}</div>
        </div>
    `;
}

// 材料入力フィールドを追加
function addIngredient() {
    const ingredientList = document.querySelector('.ingredient-list');
    const id = ++ingredientCounter;
    
    const ingredientElement = document.createElement('div');
    ingredientElement.className = 'input-group';
    ingredientElement.dataset.id = id;
    
    ingredientElement.innerHTML = `
        <div class="ingredient-controls">
            <button class="delete-ingredient" data-id="${id}">削除</button>
        </div>
        <div class="ingredient-fields">
            <div>
                <label for="ingredient-name-${id}">材料名</label>
                <input type="text" id="ingredient-name-${id}" placeholder="例: 鶏もも肉">
            </div>
            <div>
                <label for="ingredient-weight-${id}">重量 (g)</label>
                <input type="number" id="ingredient-weight-${id}" class="weight-input" min="0" step="0.1" placeholder="0.0">
            </div>
        </div>
    `;
    
    ingredientList.appendChild(ingredientElement);
    
    // 削除ボタンのイベント
    ingredientElement.querySelector('.delete-ingredient').addEventListener('click', function() {
        deleteIngredient(this.dataset.id);
    });
    
    // ユーザーが明示的に材料追加ボタンをクリックした場合のみフォーカスを設定
    if (shouldFocusNewIngredient) {
        const inputField = ingredientElement.querySelector('input[type="text"]');
        inputField.focus({preventScroll: true});
    }
}

// 材料入力フィールドを削除
function deleteIngredient(id) {
    const ingredient = document.querySelector(`.input-group[data-id="${id}"]`);
    
    // 最低1つの材料は残す
    const totalIngredients = document.querySelectorAll('.ingredient-list .input-group').length;
    if (totalIngredients <= 1) {
        alert('少なくとも1つの材料が必要です');
        return;
    }
    
    ingredient.remove();
}

// 材料の重量に基づいて調味料の量を計算します
function calculateCondiments() {
    // 全ての材料から総重量を計算
    let totalWeight = 0;
    const ingredients = document.querySelectorAll('.ingredient-list .input-group');
    
    ingredients.forEach(ingredient => {
        const id = ingredient.dataset.id;
        const weight = parseFloat(document.getElementById(`ingredient-weight-${id}`).value) || 0;
        totalWeight += weight;
    });
    
    if (totalWeight <= 0) {
        alert('材料の重量を入力してください');
        return;
    }
    
    // 現在のレシピを取得
    const recipe = recipes[currentRecipe];
    
    // 総重量を表示
    const resultItems = document.querySelectorAll('.result-item');
    resultItems[0].querySelector('span:nth-child(2)').textContent = totalWeight.toFixed(1) + ' g';
    
    // レシピの数式に基づいて調味料を計算
    // 各調味料の計算結果を名前付きの変数として保持
    let soy = 0, miso = 0, sugar = 0, sake = 0, mirin = 0, ginger = 0, garlic = 0;
    const calculatedValues = []; // 計算結果の配列（表示用）
    
    recipe.condiments.forEach((condiment, index) => {
        let displayValue;
        
        // 固定テキストかどうかをチェック
        if (condiment.isFixedText) {
            // 固定テキストの場合はそのまま表示
            displayValue = condiment.formula;
        } else if (typeof condiment.formula === 'function') {
            // 関数の場合は計算を実行
            // 調味料の名前に基づいて、計算結果を適切な変数に格納
            const condimentName = condiment.name.toLowerCase();
            
            // 関数に渡す引数を準備
            displayValue = condiment.formula(totalWeight, soy, miso, sugar, sake, mirin, ginger, garlic, totalWeight);
            const value = parseFloat(displayValue) || 0;
            calculatedValues.push(value);
            
            // 計算結果を名前付き変数に格納
            if (condimentName.includes('醤油')) {
                soy = value;
            } else if (condimentName.includes('みそ') || condimentName.includes('味噌')) {
                miso = value;
            } else if (condimentName.includes('砂糖')) {
                sugar = value;
            } else if (condimentName.includes('酒')) {
                sake = value;
            } else if (condimentName.includes('みりん') || condimentName.includes('味醂')) {
                mirin = value;
            } else if (condimentName.includes('生姜')) {
                ginger = value;
            } else if (condimentName.includes('ニンニク') || condimentName.includes('にんにく')) {
                garlic = value;
            }
        }
        
        // 結果の表示を更新 - 総重量の項目があるので +1 する
        if (resultItems[index + 1]) {
            resultItems[index + 1].querySelector('span:nth-child(2)').textContent = 
                displayValue + (condiment.unit ? ' ' + condiment.unit : '');
        }
    });
    
    // 塩分濃度情報を更新
    document.querySelector('.info-text').innerHTML = recipe.defaultSaltInfo;
    
    // 結果カードまでスクロール
    setTimeout(() => {
        document.querySelector('.result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}
