const express = require('express');
const generatedMealsRouter = express.Router();
const User = require('../models/userModel')
const Food = require('../models/foodModel')


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


// Sends an API post request to the GPT 3.5 endpoint
async function queryChatGPT(prompt) {
    const request = require("request");

    const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";

    const options = {
        url: OPENAI_API_ENDPOINT,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GPT_API_KEY}`,
            "OpenAI-Organization": process.env.GPT_ORG_ID,
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        }),
    };

    return new Promise((resolve, reject) => {
        request.post(options, (error, response, body) => {
            if (error) {
                console.error(error);
                reject(error);
            } else {
                resolve(body);
            }
        });
    });
}


// Queries the GPT 3.5 API for a meal
async function mealGenerationQuery(calories, user) {
    let includedFood = JSON.stringify(user.includeFood);
    let excludedFood = JSON.stringify(user.excludeFood);
    let includedTags = user.foodTagInclude;
    let excludedTags = user.foodTagExclude;

    if (includedFood == undefined) {
        includedFood = [];
    }
    if (excludedFood == undefined) {
        excludedFood = [];
    }
    if (includedTags == undefined) {
        includedTags = [];
    }
    if (excludedTags == undefined) {
        excludedTags = [];
    }

    const mealsPrompt =
        `Respond to me in this format:` +
        ' ```javascript[{ "Food": String, "Calories": int, "Grams": int}, ...]```' +
        `. Make me a sample ${calories} calorie meal. It must be within 100 calories of ${calories} Do not provide any extra text outside of` +
        ' ```javascript[{ "name": String, "calories": int, "grams": int }, ...]```.' +
        `These json objects must be included: ${includedFood}. These are the themes of the meal: ${includedTags}. These json objects must not be included: ${excludedFood}. Do not provide meals related to: ${excludedTags}. Remove all white space.`;

    console.log(`Initial Prompt: ${mealsPrompt}\n\n`);

    const response = await queryChatGPT(mealsPrompt);
    const mealPlan = JSON.parse(response).choices[0].message.content;

    console.log(`The response we get: ${mealPlan}\n\n`);

    const codeBlockRegex = /```javascript([\s\S]+?)```/g;
    let matches = mealPlan.match(codeBlockRegex);

    console.log(`After regex filter: ${matches}\n\n`);
    if (matches == null) {
        matches = mealPlan.match(/\[[^\[\]]*\]/);
        console.log(`After regex filter Second: ${matches}\n\n`);
    }

    if (matches == null) {
        return undefined;
    }
    let codeBlockContent;

    if (matches && matches.length > 0) {
        codeBlockContent = matches.map((match) =>
            match.replace(/```javascript|```/g, "").trim()
        );
    }

    const mealPlanParsed = JSON.parse(codeBlockContent[0]);
    console.log("Final Product\n");
    console.log(mealPlanParsed);

    return mealPlanParsed;
}


// Get generated meals page
app.get("/generatedMeals", async (req, res) => {
    let calories;
    let user = req.session.USER;
    if (req.query.calories != undefined) {
        calories = req.query.calories;
    } else {
        calories = 500;
    }
    console.log(`Calories: ${calories}\n\n`);
    let meal = await mealGenerationQuery(calories, user);
    // variable for session meal
    req.session.MEAL = meal;

    if (meal === undefined) {
        return res.redirect("/badApiResponse");
    } else {
        let totalCalories = 0;
        meal.forEach((food) => {
            totalCalories += Number(food.Calories);
        });
        res.render("generatedMeals", {
            foodItems: meal,
            totalCalories: totalCalories,
            userSpecifiedCalories: req.query.calories,
        });
    }
});


// Get bad api response page
app.get("/badApiResponse", (req, res) => {
    res.render("badApiResponse");
});


// Get meal filters page
app.get("/mealFilters", async (req, res) => {
    const user = req.session.USER;
    res.render("mealFilters", {
        tagsList: foodCategory,
        userInclude: user.includeFood,
        userExclude: user.excludeFood,
        primaryUser: user,
    });
});


// Get meal catalog pages
app.get("/foodCatalog", (req, res) => {
    let type = req.query.type;
    res.render("foodCatalog", {
        type: type,
    });
});


// Search for food
app.get("/searchFood", async (req, res) => {
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


// Select food to include or exclude
app.post("/selectFood", async (req, res) => {
    const itemId = req.body.item;
    const userId = req.session.USER.id;
    let foodToAdd = await Food.findOne({ _id: new ObjectId(itemId) });

    let reqUrl = req.get("Referrer");
    let parsedUrl = new URL(reqUrl);
    let params = parsedUrl.searchParams;
    let type = params.get("type");

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

    let updatedUser = await User.findOne({ id: userId });
    req.session.USER = updatedUser;
    res.redirect("/mealFilters");
});


// Modify food tag
app.post("/modifyFoodTag", async (req, res) => {
    const foodTag = req.body.foodTag;
    const userId = req.session.USER.id;
    const type = req.body.type;
    let user = await User.findOne({ id: userId });

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

    let updatedUser = await User.findOne({ id: userId });
    req.session.USER = updatedUser;
    res.redirect("/mealFilters");
});


// Remove food item from filter
app.post("/deleteFood", async (req, res) => {
    const foodName = req.body.item;
    const userId = req.session.USER.id;
    const type = req.body.type;

    let foodToDelete = await Food.findOne({ Food: foodName });

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

    let updatedUser = await User.findOne({ id: userId });
    req.session.USER = updatedUser;
    res.redirect("/mealFilters");
});


module.exports = generatedMealsRouter