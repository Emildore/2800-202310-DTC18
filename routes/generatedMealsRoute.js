/**
 * Router to handle requests to endpoints related to generated meals.
 */

// Set up dependencies
const express = require("express");
const generatedMealsRouter = express.Router();
const User = require("../models/userModel");
const Food = require("../models/foodModel");
const { ObjectId } = require("mongodb");

// Meal model
const Meal = require("../models/mealModel");
// FavoriteMeal model
const FavoriteMeal = require("../models/favMealModel");
// Import function to query chatGPT
const { queryChatGPT, parseResponse } = require("./chatGptHelpers");

// Available food tags
const foodCategory = [
  { name: "Dairy products" },
  { name: "Fats, Oils, Shortenings" },
  { name: "Meat, Poultry" },
  { name: "Fish, Seafood" },
  { name: "Vegetables A-E" },
  { name: "Vegetables F-P" },
  { name: "Vegetables R-Z" },
  { name: "Fruits A-F" },
  { name: "Fruits G-P" },
  { name: "Fruits R-Z" },
  { name: "Breads, cereals, fastfood, grains" },
  { name: "Soups" },
  { name: "Desserts, sweets" },
  { name: "Jams, Jellies" },
  { name: "Seeds and Nuts" },
  { name: "Drinks,Alcohol, Beverages" },
];


/**
 * Queries the GPT API to generate a meal based on user conditions.
 *
 * @async
 * @param {number} calories - the calories that the meal will query to have
 * @param {Object} user - an object representing the current user
 * @returns {Array<Object>|undefined} - the meal as an array of JSON objects or undefined if parsing fails
 */
async function mealGenerationQuery(calories, user) {
  let includedFood = JSON.stringify(user.includeFood) ?? [];
  let excludedFood = JSON.stringify(user.excludeFood) ?? [];
  let includedTags = user.foodTagInclude ?? [];
  let excludedTags = user.foodTagExclude ?? [];

  const mealsPrompt =
    `Respond to me in this format:` +
    ' ```javascript[{ "Food": String, "Calories": int, "Grams": int}, ...]```' +
    `. Make me a sample ${calories} calorie meal. It must be within 100 calories of ${calories} Do not provide any extra text outside of` +
    ' ```javascript[{ "name": String, "calories": int, "grams": int }, ...]```.' +
    `These json objects must be included: ${includedFood}. These are the themes of the meal: ${includedTags}. These json objects must not be included: ${excludedFood}. Do not provide meals related to: ${excludedTags}. Remove all white space.`;

  console.log(`Initial Prompt: ${mealsPrompt}\n\n`);

  const response = await queryChatGPT(mealsPrompt);
  let mealParsed = parseResponse(response);

  if (!mealParsed) {
    return undefined;
  }

  console.log("Final Product\n");
  console.log(mealParsed);

  return mealParsed;
}


/**
 * Renders the "generatedMeals" view with data in the response.
 * The data contains the following:
 * - the meal
 * - the calories of the meal
 * - the amount of calories the user asks for
 * - the user's included tags
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.get("/", async (req, res) => {
  let meal = req.session.MEAL;
  if (meal === undefined) {
    return res.redirect("/badApiResponse");
  }
  let totalCalories = 0;
  meal.forEach((food) => {
    totalCalories += Number(food.Calories);
  });

  let user = req.session.USER;
  let calories = user.calories;

  res.render("generatedMeals/generatedMeals", {
    foodItems: meal,
    totalCalories: totalCalories,
    userSpecifiedCalories: req.query.calories,
    tagsList: user.foodTagInclude,
    calories: calories,
  });
});


/**
 * Processes the API request and redirects to the appropriate page when completed.
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.get("/loadingData", async (req, res) => {
  let user = req.session.USER;
  let updatedUser = await User.findOne({ id: user.id });
  req.session.USER = updatedUser;

  let calories = updatedUser.calories;
  let meal = await mealGenerationQuery(calories, user);
  // variable for session meal
  req.session.MEAL = meal;

  if (meal === undefined) {
    return res.redirect("/badApiResponse");
  } else {
    console.log("Success");
    return res.redirect("./");
  }
});


/**
 * Renders the "mealFilters" view with data in the response.
 * The data contains the following:
 * - the categories available in our database
 * - the user's included food items
 * - the user's excluded food items
 * - the User of the current session
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.get("/mealFilters", async (req, res) => {
  const user = req.session.USER;
  calories = user.calories;
  res.render("generatedMeals/mealFilters", {
    tagsList: foodCategory,
    userInclude: user.includeFood,
    userExclude: user.excludeFood,
    primaryUser: user,
    calories: calories,
  });
});


/**
 * Renders the "foodCatalog" view with the type of catalog in the response.
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.get("/foodCatalog", (req, res) => {
  let type = req.query.type;
  res.render("generatedMeals/foodCatalog", {
    type: type,
  });
});


/**
 * Renders the "quickAddMeal" view in the response.
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.get("/quickAddMeal", (req, res) => {
  res.render("generatedMeals/quickAddMeal");
});


/**
 * Handles the POST request to quick add a meal.
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.post("/quickAddMeal", async (req, res) => {
  const itemId = req.body.item;
  const userId = req.session.USER.id;
  let foodToAdd = await Food.findOne({ _id: new ObjectId(itemId) });

  // get current date and time as a string
  const date = new Date();

  // Create a new meal document
  const meal = new Meal({
    userId: userId,
    mealName: foodToAdd.Food,
    items: [
      {
        Food: foodToAdd.Food,
        Calories: foodToAdd.Calories,
        Grams: foodToAdd.Grams,
      },
    ],
    createdTime: new Date(date.getTime()),
    expireTime: new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000), // set the expiry time 30 days from now
  });

  // Save the meal document
  await meal.save();

  let updatedUser = await User.findOne({ id: userId });
  req.session.USER = updatedUser;
  res.redirect("./quickAddMeal");
});


/**
 * Searches the database based on the request query criteria and sends an array of JSON in the response.
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.get("/searchFood", async (req, res) => {
  const searchQuery = req.query.q;
  let foodQuery = await Food.find({ Food: new RegExp(searchQuery, "i") });
  let parsedResponse = foodQuery.map((foodObject) => {
    return {
      name: foodObject.Food,
      measure: foodObject.Measure,
      calories: foodObject.Calories,
      id: foodObject._id,
    };
  });

  res.json(parsedResponse);
});


/**
 * Adds the food to the current user's included or excluded foods list.
 *
 * @param {string} type the type of the list to add to
 * @param {string} itemId the ID of the item to add
 * @param {string} userId the ID of the current user
 */
async function addFoodUser(type, itemId, userId) {
  let foodToAdd = await Food.findOne({ _id: new ObjectId(itemId) });
  if (type === "include") {
    await User.updateOne(
      { id: userId },
      {
        $addToSet: {
          includeFood: {
            $each: [
              {
                Food: foodToAdd.Food,
                Calories: foodToAdd.Calories,
                Grams: foodToAdd.Grams,
              },
            ],
          },
        },
      }
    );
  } else {
    await User.updateOne(
      { id: userId },
      {
        $addToSet: {
          excludeFood: {
            $each: [
              {
                Food: foodToAdd.Food,
                Calories: foodToAdd.Calories,
                Grams: foodToAdd.Grams,
              },
            ],
          },
        },
      }
    );
  }
}


/**
 * Handles the POST request to add food items to include or exclude.
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.post("/selectFood", async (req, res) => {
  const itemId = req.body.item;
  const userId = req.session.USER.id;

  let reqUrl = req.get("Referrer");
  let parsedUrl = new URL(reqUrl);
  let params = parsedUrl.searchParams;
  let type = params.get("type");

  await addFoodUser(type, itemId, userId);

  let updatedUser = await User.findOne({ id: userId });
  req.session.USER = updatedUser;
  res.redirect("./mealFilters");
});


/**
 * Updates the user's food tag to include or exclude.
 *
 * @param {string} type - the type of the tag to update, include or exclude
 * @param {string} userId - the ID of the user to update
 * @param {string} foodTag - the name of the tag to include or exclude
 * @param {Object} user - an object representing the current user
 */
async function updateFoodTag(type, userId, foodTag, user) {
  if (type === "include") {
    if (user.foodTagInclude && user.foodTagInclude.includes(foodTag)) {
      // If the tag is already present, remove it
      await User.updateOne(
        { id: userId },
        { $pull: { foodTagInclude: foodTag } }
      );
    } else {
      // Otherwise, add the tag
      await User.updateOne(
        { id: userId },
        { $addToSet: { foodTagInclude: foodTag } }
      );
    }
  } else {
    if (user.foodTagExclude && user.foodTagExclude.includes(foodTag)) {
      // If the tag is already present, remove it
      await User.updateOne(
        { id: userId },
        { $pull: { foodTagExclude: foodTag } }
      );
    } else {
      // Otherwise, add the tag
      await User.updateOne(
        { id: userId },
        { $addToSet: { foodTagExclude: foodTag } }
      );
    }
  }
}


/**
 * Handles the POST request to modify the food tags included or excluded.
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.post("/modifyFoodTag", async (req, res) => {
  const foodTag = req.body.foodTag;
  const userId = req.session.USER.id;
  const type = req.body.type;
  let user = await User.findOne({ id: userId });

  await updateFoodTag(type, userId, foodTag, user);

  let updatedUser = await User.findOne({ id: userId });
  req.session.USER = updatedUser;
  res.redirect("./mealFilters");
});


/**
 * Deletes the specified food item from included or excluded food items.
 *
 * @param {string} type - the type of the food to delete, include or exclude
 * @param {string} userId - the ID of the current user
 * @param {Object} foodToDelete - an object representing the food to delete
 */
async function deleteFoodUser(type, userId, foodToDelete) {
  if (type === "include") {
    await User.updateOne(
      { id: userId },
      {
        $pull: {
          includeFood: {
            Food: foodToDelete.Food,
            Calories: foodToDelete.Calories,
            Grams: foodToDelete.Grams,
          },
        },
      }
    );
  } else {
    await User.updateOne(
      { id: userId },
      {
        $pull: {
          excludeFood: {
            Food: foodToDelete.Food,
            Calories: foodToDelete.Calories,
            Grams: foodToDelete.Grams,
          },
        },
      }
    );
  }
}


/**
 * Handles the POST request to delete a food item from a user's included or excluded food items.
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.post("/deleteFood", async (req, res) => {
  const foodName = req.body.item;
  const userId = req.session.USER.id;
  const type = req.body.type;
  let foodToDelete = await Food.findOne({ Food: foodName });

  await deleteFoodUser(type, userId, foodToDelete);

  let updatedUser = await User.findOne({ id: userId });
  req.session.USER = updatedUser;
  res.redirect("./mealFilters");
});


/**
 * Handles the POST request to add a generated meal to user's favorite meals.
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.post("/favoriteMeals", async (req, res) => {
  const meal = req.session.MEAL;
  const userId = req.session.USER.id;
  // ADD meal to FavoriteMeal collection
  const favMeal = new FavoriteMeal({
    userId: userId,
    mealName: meal[0].Food,
    items: meal,
  });
  await favMeal.save();
  console.log("Saved");

  // delete session variable
  delete req.session.MEAL;
  await User.updateOne({ id: userId }, { $set: { calories: 500 } });
  res.redirect("/favoriteMeals");
});


/**
 * Handles the POST request to delete a meal from user's favorite meals.
 *
 * @param {Express.Request} req - the request object representing the received request
 * @param {Express.Response} res - the response object representing the server response
 */
generatedMealsRouter.post("/deleteFromFavoriteMeals", async (req, res) => {
  const mealId = req.body.deleteFavoriteMealId;
  const userId = req.session.USER.id;

  await FavoriteMeal.deleteOne({ _id: mealId, userId: userId });
  res.redirect("/favoriteMeals");
});


// Export the generatedMealsRouter
module.exports = generatedMealsRouter;
