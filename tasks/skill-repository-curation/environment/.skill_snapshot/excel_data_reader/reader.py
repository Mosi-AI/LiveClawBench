"""Excel Data Reader - Read Excel files with sheet selection and save as parquet."""

import argparse
import pandas as pd


def read_excel(input_path, output_path, sheet_name=0, header_row=0):
    """Read an Excel file, optionally selecting a sheet, and save as parquet."""
    # Read sheet names for reporting
    xls = pd.ExcelFile(input_path)
    available_sheets = xls.sheet_names
    print(f"Available sheets: {available_sheets}")

    # Resolve sheet name
    selected = sheet_name
    if isinstance(sheet_name, str) and sheet_name.isdigit():
        selected = int(sheet_name)

    df = pd.read_excel(input_path, sheet_name=selected, header=header_row)

    # Strip whitespace from string columns
    str_cols = df.select_dtypes(include=["object"]).columns
    for col in str_cols:
        df[col] = df[col].str.strip()

    df.to_parquet(output_path, index=False)

    print(f"Read Excel: {input_path}")
    print(f"  Sheet: {selected}")
    print(f"  Rows: {len(df)}, Columns: {len(df.columns)}")
    print(f"  Columns: {list(df.columns)}")
    print(f"  Saved to: {output_path}")
    return df


def main():
    parser = argparse.ArgumentParser(description="Read Excel and save as parquet")
    parser.add_argument("-i", "--input", required=True, help="Input Excel file path")
    parser.add_argument(
        "-o", "--output", required=True, help="Output parquet file path"
    )
    parser.add_argument(
        "-s", "--sheet", default="0", help="Sheet name or index (default: 0)"
    )
    parser.add_argument("--header-row", type=int, default=0, help="Header row index")
    args = parser.parse_args()

    read_excel(args.input, args.output, args.sheet, args.header_row)


if __name__ == "__main__":
    main()
