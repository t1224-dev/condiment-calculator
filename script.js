// Variables to store recipe data and current recipe
let recipes = {};
let currentRecipe = 'teriyaki';

// DOM elements
const recipeTabsContainer = document.getElementById('recipe-tabs-container');
const mainCardContainer = document.getElementById('main-card-container');
const resultCardContainer = document.getElementById('result-card-container');
const cuisineFilter = document.getElementById('cuisine-filter');
const recipeSearch = document.getElementById('recipe-search');

// Load recipes from JSON file and initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadRecipes()
        .then(() => {
            initializePage();
        })
        .catch(error => {
            console.error('レシピデータの読み込みに失敗しました:', error);
            // エラー時のフォールバック表示
            mainCardContainer.innerHTML = `
                <div class="card">
                    <div class="card-title">
                        <h2>エラー</h2>
                    </div>
                    <p>レシピデータの読み込みに失敗しました。ページを再読み込みしてください。</p>
                </div>
            `;
        });
});

// Function to load recipes from JSON file
async function loadRecipes() {
    try {
        const response = await fetch('recipes.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recipeData = await response.json();
        recipes = processRecipeData(recipeData);
    } catch (error) {
        console.error('レシピデータの読み込みエラー:', error);
        throw error;
    }
}

// Process the loaded recipe data to convert string formulas to functions
function processRecipeData(recipeData) {
    const processedRecipes = {};
    
    Object.keys(recipeData).forEach(recipeKey => {
        const recipe = recipeData[recipeKey];
        const processedRecipe = {
            ...recipe,
            condiments: recipe.condiments.map(condiment => {
                // 数式をFunction型に変換
                if (condiment.formula && typeof condiment.formula === 'string') {
                    if (['適量', 'お好みで', 'ひたひた', 'お好みで適量'].includes(condiment.formula)) {
                        // 「適量」などの固定値はそのまま関数にする
                        condiment.formula = () => condiment.formula;
                    } else {
                        // 数式を関数に変換
                        condiment.formula = createFormulaFunction(condiment.formula);
                    }
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

// Create a function from a formula string
function createFormulaFunction(formulaString) {
    if (formulaString.startsWith('固定値:')) {
        const fixedValue = parseFloat(formulaString.split(':')[1]);
        return () => fixedValue.toFixed(1);
    }
    
    return function(total, ...args) {
        // 変数をセットアップ
        const variables = {
            total: total,
            soy: args[0] || 0,
            miso: args[0] || 0,
            sake: args[1] || 0,
            ginger: args[2] || 0
        };
        
        // 変数を置き換えた式を評価
        const formula = formulaString.replace(/total|soy|miso|sake|ginger/g, match => variables[match]);
        
        try {
            return eval(formula).toFixed(1);
        } catch (error) {
            console.error('計算式の評価に失敗:', formula, error);
            return '0.0';
        }
    };
}

// Create a salt info function from the salt formula
function createSaltInfoFunction(defaultSaltInfo, saltFormula) {
    if (!saltFormula) {
        return () => defaultSaltInfo;
    }
    
    if (saltFormula.startsWith('固定値:')) {
        const fixedValue = saltFormula.split(':')[1];
        return (weight, ...args) => {
            if (saltFormula.includes('みそ')) {
                return `塩分濃度: ${fixedValue}%<br>みそ塩分濃度: 0.9%<br>醤油塩分濃度: 0.3%`;
            }
            return `塩分濃度: ${fixedValue}% (みそ1gあたり塩分含有量: 0.13g)`;
        };
    }
    
    return function(weight, ...args) {
        const soy = args[0] || 0;
        
        // 塩分濃度計算式を評価
        const variables = {
            weight: weight,
            soy: soy
        };
        
        const formula = saltFormula.replace(/weight|soy/g, match => variables[match]);
        
        try {
            const saltPercentage = eval(formula).toFixed(1);
            return `塩分濃度: ${saltPercentage}% (醤油1gあたり塩分含有量: 0.15g)`;
        } catch (error) {
            console.error('塩分計算式の評価に失敗:', formula, error);
            return defaultSaltInfo;
        }
    };
}

// Initialize page
function initializePage() {
    // Generate recipe tabs
    generateRecipeTabs();
    
    // Generate main card
    generateMainCard();
    
    // Generate result card
    generateResultCard();
    
    // Set up event listeners
    setupEventListeners();
}

// Generate recipe tabs based on available recipes
function generateRecipeTabs() {
    recipeTabsContainer.innerHTML = '';
    
    // Create a tab for each recipe
    Object.keys(recipes).forEach((recipeKey, index) => {
        const recipe = recipes[recipeKey];
        const tab = document.createElement('div');
        tab.className = 'recipe-tab';
        if (recipeKey === currentRecipe) {
            tab.classList.add('active');
        }
        
        tab.innerHTML = `
            <span>${recipe.name}</span>
            <span class="cuisine-tag ${recipe.cuisine}">${getCuisineName(recipe.cuisine)}</span>
        `;
        
        tab.dataset.recipe = recipeKey;
        
        recipeTabsContainer.appendChild(tab);
    });
}

// Generate the main card with ingredients input
function generateMainCard() {
    const recipe = recipes[currentRecipe];
    
    mainCardContainer.innerHTML = `
        <div class="card">
            <div class="card-title">
                <h2>${recipe.name}</h2>
                <div class="actions">
                    <button id="calculate-button">計算</button>
                </div>
            </div>

            <h3>材料</h3>
            <div class="ingredient-list">
                <div class="input-group" data-id="1">
                    <div class="ingredient-controls">
                        <button class="delete-ingredient">削除</button>
                    </div>
                    <div class="ingredient-fields">
                        <div>
                            <label for="ingredient-name-1">材料1</label>
                            <input type="text" id="ingredient-name-1" placeholder="材料名を入力">
                        </div>
                        <div>
                            <label for="ingredient-weight-1">重量 (g)</label>
                            <input type="number" id="ingredient-weight-1" placeholder="0.0" step="0.1" min="0" class="weight-input">
                        </div>
                    </div>
                </div>
            </div>

            <button id="add-ingredient-button" class="icon add-ingredient">
                + 材料を追加
            </button>
        </div>
    `;
    
    // Add event listeners to the newly created elements
    document.getElementById('calculate-button').addEventListener('click', calculateCondiments);
    document.getElementById('add-ingredient-button').addEventListener('click', addIngredient);
    addDeleteListeners();
}

// Generate the result card showing condiment calculations
function generateResultCard() {
    const recipe = recipes[currentRecipe];
    
    let resultItems = '';
    // 総重量表示用の項目を先頭に追加
    resultItems += `
        <div class="result-item total-weight">
            <span>材料総重量</span>
            <span>0.0 g</span>
        </div>
    `;
    
    recipe.condiments.forEach(condiment => {
        resultItems += `
            <div class="result-item">
                <span>${condiment.name}</span>
                <span>0.0 ${condiment.unit}</span>
            </div>
        `;
    });
    
    resultCardContainer.innerHTML = `
        <div class="card result-card">
            <h2>計算結果</h2>
            <div class="result-list">
                ${resultItems}
            </div>
            <p class="info-text">
                ${recipe.defaultSaltInfo}
            </p>
        </div>
    `;
}

// Set up event listeners
function setupEventListeners() {
    // Recipe tab click event
    recipeTabsContainer.addEventListener('click', function(e) {
        const tab = e.target.closest('.recipe-tab');
        if (tab) {
            const recipeKey = tab.dataset.recipe;
            if (recipeKey && recipeKey !== currentRecipe) {
                currentRecipe = recipeKey;
                updateRecipeDisplay();
            }
        }
    });
    
    // Filter recipes by cuisine type
    cuisineFilter.addEventListener('change', filterRecipes);
    
    // Filter recipes by name search
    recipeSearch.addEventListener('input', filterRecipes);
}

// Update the display when a new recipe is selected
function updateRecipeDisplay() {
    // Update active tab
    document.querySelectorAll('.recipe-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.recipe === currentRecipe) {
            tab.classList.add('active');
        }
    });
    
    // Regenerate the main card and result card
    generateMainCard();
    generateResultCard();
}

// Filter recipes based on cuisine and search query
function filterRecipes() {
    const cuisineValue = cuisineFilter.value;
    const searchValue = recipeSearch.value.toLowerCase();
    
    document.querySelectorAll('.recipe-tab').forEach(tab => {
        const recipeKey = tab.dataset.recipe;
        const recipe = recipes[recipeKey];
        const recipeName = recipe.name.toLowerCase();
        const cuisineType = recipe.cuisine;
        
        const matchesCuisine = cuisineValue === 'all' || cuisineValue === cuisineType;
        const matchesSearch = searchValue === '' || recipeName.includes(searchValue);
        
        tab.style.display = matchesCuisine && matchesSearch ? 'flex' : 'none';
    });
}

// Add ingredient functionality
function addIngredient() {
    const ingredientList = document.querySelector('.ingredient-list');
    const ingredientCount = ingredientList.children.length + 1;
    
    if (ingredientCount <= 10) {
        const newIngredient = document.createElement('div');
        newIngredient.className = 'input-group';
        newIngredient.dataset.id = ingredientCount;
        newIngredient.innerHTML = `
            <div class="ingredient-controls">
                <button class="delete-ingredient">削除</button>
            </div>
            <div class="ingredient-fields">
                <div>
                    <label for="ingredient-name-${ingredientCount}">材料${ingredientCount}</label>
                    <input type="text" id="ingredient-name-${ingredientCount}" placeholder="材料名を入力">
                </div>
                <div>
                    <label for="ingredient-weight-${ingredientCount}">重量 (g)</label>
                    <input type="number" id="ingredient-weight-${ingredientCount}" placeholder="0.0" step="0.1" min="0" class="weight-input">
                </div>
            </div>
        `;
        ingredientList.appendChild(newIngredient);
        
        // Add delete functionality to the new ingredient
        addDeleteListeners();
    }
    
    // If we've reached the maximum allowed ingredients, disable the add button
    if (ingredientCount >= 10) {
        document.getElementById('add-ingredient-button').disabled = true;
    }
}

// Delete ingredient functionality
function addDeleteListeners() {
    document.querySelectorAll('.delete-ingredient').forEach(button => {
        // Remove any existing event listeners to prevent duplicates
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', function() {
            const ingredientGroup = this.closest('.input-group');
            ingredientGroup.remove();
            
            // Re-enable the add button if it was disabled
            document.getElementById('add-ingredient-button').disabled = false;
            
            // Renumber the remaining ingredients
            const ingredients = document.querySelectorAll('.ingredient-list .input-group');
            ingredients.forEach((ingredient, index) => {
                const newIndex = index + 1;
                ingredient.dataset.id = newIndex;
                ingredient.querySelector('label[for^="ingredient-name-"]').textContent = `材料${newIndex}`;
                ingredient.querySelector('input[type="text"]').id = `ingredient-name-${newIndex}`;
                ingredient.querySelector('input[type="number"]').id = `ingredient-weight-${newIndex}`;
            });
        });
    });
}

// Calculate condiment amounts based on ingredient weights
function calculateCondiments() {
    // Calculate total weight from all ingredients
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
    
    // Get current recipe
    const recipe = recipes[currentRecipe];
    
    // 総重量を表示
    const resultItems = document.querySelectorAll('.result-item');
    resultItems[0].querySelector('span:nth-child(2)').textContent = totalWeight.toFixed(1) + ' g';
    
    // Calculate condiments based on recipe formulas
    const condimentValues = [];
    recipe.condiments.forEach((condiment, index) => {
        let value;
        if (index === 0) {
            // First condiment calculation is always based on total weight only
            value = condiment.formula(totalWeight);
        } else if (typeof condiment.formula === 'function') {
            // For other condiments, pass the total weight and all previous condiment values
            value = condiment.formula(totalWeight, ...condimentValues);
        }
        condimentValues.push(parseFloat(value) || 0);
        
        // Update results display - 総重量の項目があるので +1 する
        if (resultItems[index + 1]) {
            resultItems[index + 1].querySelector('span:nth-child(2)').textContent = value + (condiment.unit ? ' ' + condiment.unit : '');
        }
    });
    
    // Update salt concentration info
    document.querySelector('.info-text').innerHTML = recipe.saltInfo(totalWeight, ...condimentValues);
    
    // Scroll to the result card
    setTimeout(() => {
        document.querySelector('.result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Helper function to get cuisine name in Japanese
function getCuisineName(cuisine) {
    const cuisineNames = {
        'japanese': '和風',
        'western': '洋風',
        'chinese': '中華風',
        'korean': '韓国風',
        'other': 'その他'
    };
    return cuisineNames[cuisine] || cuisine;
}