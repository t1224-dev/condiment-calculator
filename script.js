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
    const calculatedValues = []; // 計算に使用する値の配列
    
    recipe.condiments.forEach((condiment, index) => {
        let displayValue;
        
        // 固定テキストかどうかをチェック
        if (condiment.isFixedText) {
            // 固定テキストの場合はそのまま表示
            displayValue = condiment.formula;
        } else if (typeof condiment.formula === 'function') {
            // 関数の場合は計算を実行
            if (index === 0) {
                // 最初の調味料は総重量のみに基づいて計算
                displayValue = condiment.formula(totalWeight);
                calculatedValues.push(parseFloat(displayValue) || 0);
            } else {
                // 他の調味料は総重量と前の調味料の値に基づいて計算
                displayValue = condiment.formula(totalWeight, ...calculatedValues);
                calculatedValues.push(parseFloat(displayValue) || 0);
            }
        }
        
        // 結果の表示を更新 - 総重量の項目があるので +1 する
        if (resultItems[index + 1]) {
            resultItems[index + 1].querySelector('span:nth-child(2)').textContent = 
                displayValue + (condiment.unit ? ' ' + condiment.unit : '');
        }
    });
    
    // 塩分濃度情報を更新
    document.querySelector('.info-text').innerHTML = recipe.saltInfo(totalWeight, ...calculatedValues);
    
    // 結果カードまでスクロール
    setTimeout(() => {
        document.querySelector('.result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}
