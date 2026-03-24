## Task Description

You are asked build a CRM (Customer Relationship Management) project and extract information. The source code is located at `/workspace/vue-crm/`. This is a Vue web application that needs to be installed and run locally before extracting information.

This project still has some bugs and errors that you need to identify and fix.

## Your Tasks

1. **Install the project** according to the README.md file. Try to fix any problems that occur during the installation process. Then start the development server and make sure it runs successfully. You should see output indicating the local server is running.

2. **Open the homepage** in the browser at localhost. When you see a Dashboard page titled "Vue Demo V3", it means success. If you see "This page you are looking for could not be found.", there are still bugs to fix.

3. **Extract dashboard data**: Find and record the following values from the Dashboard page:
   - "Total Growth" amount
   Write the result to `/workspace/answer_file.json` in JSON format:
   ```json
   {"Total Growth": xxx}
   ```

## Important Notes

- The project root is `/workspace/vue-crm/`
- You need to use browser automation tools to interact with the web interface
- This project still has some bugs and errors that you need to identify and fix
- Common issues might include: Vite plugin order problems / Incorrect base path configuration / Build configuration errors
- Ensure the answer file is written in valid JSON format

