Please verify that the Smart Home mock environment is working correctly by performing the following tests:

1. **Health Check**: Access http://localhost:5003/health and verify it returns a healthy status

2. **Thermostat Test**:
   - GET the current thermostat settings from /api/thermostat
   - Change the thermostat mode to "eco" and temperature to 68°F via POST to /api/thermostat
   - Verify the change persisted by GET /api/thermostat again

3. **Coffee Schedule Test**:
   - GET the current coffee schedule from /api/coffee-schedule
   - Verify the status is derived correctly based on benchmark_clock

4. **Inventory Test**:
   - GET all inventory items from /api/inventory
   - Add a new item "Eggs" with quantity 12, unit "pieces", location "fridge"
   - Verify the item was added

5. **Grocery Order Test**:
   - GET available products from /api/grocery/products
   - Create an order with 2 units of "PROD001" (Organic Milk)
   - Verify the order was created with correct total

6. **Calendar Test**:
   - GET calendar events from /api/calendar
   - Update the workout event (id=1) to change workout_type from "yoga" to "walking"
   - Verify the update persisted

7. **Meal Plan Test**:
   - Create a 7-day meal plan using available recipes
   - Verify the plan was saved and can be retrieved

Report the results of each test.
