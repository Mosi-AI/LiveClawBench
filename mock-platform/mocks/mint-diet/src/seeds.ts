import type { Database } from "bun:sqlite";

interface SeedFood {
  name: string;
  serving_size_value: number;
  serving_size_unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const FOOD_CATALOG: SeedFood[] = [
  // ZH foods (15)
  { name: "白米饭", serving_size_value: 200, serving_size_unit: "g", calories_kcal: 260, protein_g: 4.8, carbs_g: 57.6, fat_g: 0.4 },
  { name: "糙米饭", serving_size_value: 200, serving_size_unit: "g", calories_kcal: 220, protein_g: 4.6, carbs_g: 45.8, fat_g: 1.8 },
  { name: "全麦面包", serving_size_value: 35, serving_size_unit: "g", calories_kcal: 82, protein_g: 3.5, carbs_g: 15.0, fat_g: 1.1 },
  { name: "白吐司", serving_size_value: 30, serving_size_unit: "g", calories_kcal: 80, protein_g: 2.5, carbs_g: 14.8, fat_g: 1.0 },
  { name: "鸡蛋", serving_size_value: 50, serving_size_unit: "g", calories_kcal: 72, protein_g: 6.3, carbs_g: 0.4, fat_g: 5.0 },
  { name: "鸡胸肉", serving_size_value: 150, serving_size_unit: "g", calories_kcal: 195, protein_g: 36.0, carbs_g: 0.0, fat_g: 4.5 },
  { name: "三文鱼", serving_size_value: 100, serving_size_unit: "g", calories_kcal: 208, protein_g: 20.0, carbs_g: 0.0, fat_g: 13.0 },
  { name: "牛肉", serving_size_value: 100, serving_size_unit: "g", calories_kcal: 250, protein_g: 26.0, carbs_g: 0.0, fat_g: 15.0 },
  { name: "豆腐", serving_size_value: 100, serving_size_unit: "g", calories_kcal: 76, protein_g: 8.0, carbs_g: 1.9, fat_g: 4.2 },
  { name: "牛奶", serving_size_value: 240, serving_size_unit: "ml", calories_kcal: 149, protein_g: 8.0, carbs_g: 11.7, fat_g: 8.0 },
  { name: "酸奶", serving_size_value: 100, serving_size_unit: "g", calories_kcal: 61, protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3 },
  { name: "燕麦", serving_size_value: 40, serving_size_unit: "g", calories_kcal: 152, protein_g: 5.0, carbs_g: 27.0, fat_g: 2.5 },
  { name: "香蕉", serving_size_value: 120, serving_size_unit: "g", calories_kcal: 107, protein_g: 1.3, carbs_g: 27.1, fat_g: 0.4 },
  { name: "苹果", serving_size_value: 180, serving_size_unit: "g", calories_kcal: 94, protein_g: 0.5, carbs_g: 25.1, fat_g: 0.3 },
  { name: "牛油果", serving_size_value: 100, serving_size_unit: "g", calories_kcal: 160, protein_g: 2.0, carbs_g: 8.5, fat_g: 14.7 },
  // EN foods (15)
  { name: "oatmeal", serving_size_value: 40, serving_size_unit: "g", calories_kcal: 152, protein_g: 5.0, carbs_g: 27.0, fat_g: 2.5 },
  { name: "whole-grain bread", serving_size_value: 35, serving_size_unit: "g", calories_kcal: 82, protein_g: 3.5, carbs_g: 15.0, fat_g: 1.1 },
  { name: "chicken breast", serving_size_value: 150, serving_size_unit: "g", calories_kcal: 195, protein_g: 36.0, carbs_g: 0.0, fat_g: 4.5 },
  { name: "salmon", serving_size_value: 100, serving_size_unit: "g", calories_kcal: 208, protein_g: 20.0, carbs_g: 0.0, fat_g: 13.0 },
  { name: "beef steak", serving_size_value: 150, serving_size_unit: "g", calories_kcal: 375, protein_g: 39.0, carbs_g: 0.0, fat_g: 22.5 },
  { name: "tofu", serving_size_value: 100, serving_size_unit: "g", calories_kcal: 76, protein_g: 8.0, carbs_g: 1.9, fat_g: 4.2 },
  { name: "greek yogurt", serving_size_value: 170, serving_size_unit: "g", calories_kcal: 100, protein_g: 17.0, carbs_g: 6.0, fat_g: 0.7 },
  { name: "milk", serving_size_value: 240, serving_size_unit: "ml", calories_kcal: 149, protein_g: 8.0, carbs_g: 11.7, fat_g: 8.0 },
  { name: "banana", serving_size_value: 120, serving_size_unit: "g", calories_kcal: 107, protein_g: 1.3, carbs_g: 27.1, fat_g: 0.4 },
  { name: "apple", serving_size_value: 180, serving_size_unit: "g", calories_kcal: 94, protein_g: 0.5, carbs_g: 25.1, fat_g: 0.3 },
  { name: "avocado", serving_size_value: 100, serving_size_unit: "g", calories_kcal: 160, protein_g: 2.0, carbs_g: 8.5, fat_g: 14.7 },
  { name: "almonds", serving_size_value: 28, serving_size_unit: "g", calories_kcal: 164, protein_g: 6.0, carbs_g: 6.1, fat_g: 14.2 },
  { name: "peanut butter", serving_size_value: 32, serving_size_unit: "g", calories_kcal: 191, protein_g: 7.1, carbs_g: 6.3, fat_g: 16.4 },
  { name: "spinach", serving_size_value: 50, serving_size_unit: "g", calories_kcal: 12, protein_g: 1.7, carbs_g: 1.0, fat_g: 0.2 },
  { name: "broccoli", serving_size_value: 100, serving_size_unit: "g", calories_kcal: 34, protein_g: 2.8, carbs_g: 6.6, fat_g: 0.4 },
];

export function seedFoodCatalog(db: Database): void {
  const count = (db.query("SELECT COUNT(*) AS cnt FROM food_catalog").get() as { cnt: number }).cnt;
  if (count > 0) {
    console.log(`Food catalog already seeded with ${count} items`);
    return;
  }

  const insert = db.prepare(`
    INSERT INTO food_catalog (name, serving_size_value, serving_size_unit, calories_kcal, protein_g, carbs_g, fat_g)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  console.log(`Seeding food catalog with ${FOOD_CATALOG.length} items`);
  db.transaction(() => {
    for (const food of FOOD_CATALOG) {
      insert.run(food.name, food.serving_size_value, food.serving_size_unit, food.calories_kcal, food.protein_g, food.carbs_g, food.fat_g);
    }
  })();
}
