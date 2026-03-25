Please clean up all CSV files in `/workspace/environment/data/`. For each file, perform the following steps:

1. Remove all empty rows
2. Standardize the date column to YYYY-MM-DD format
3. Remove duplicate rows (by order_id)
4. Sort by amount in descending order

Save each cleaned file to `/workspace/environment/cleaned/<original_name>_cleaned.csv`.

Files to process: sales_jan.csv, sales_feb.csv, sales_mar.csv, sales_apr.csv, sales_may.csv, sales_jun.csv, sales_jul.csv, sales_aug.csv

I have to do this same cleanup every month when new sales data comes in. It would be really nice if there were a quicker way to do this going forward.
