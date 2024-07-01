const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MySQL database setup
const db = mysql.createConnection({
	host: "localhost",
	user: "root",
	password: "Joseph491626128090",
	database: "myDatabase",
	insecureAuth: true,
});

db.connect((err) => {
	if (err) {
		console.error("Database connection error:", err.message);
	} else {
		console.log("Connected to the MySQL database.");
	}
});


// ************************* Register ************************************************************
app.get("/", (req, res) => {
	res.sendFile(__dirname + "/index.html");
});

app.post("/register", (req, res) => {
	const { userName, email, password, userGender, userMNr } = req.body;

	// Save user data in the 'users' table
	db.query(
		`INSERT INTO users (userName, email, password, userGender, userMNr) VALUES (?, ?, ?, ?, ?)`,
		[userName, email, password, userGender, userMNr],
		(err, result) => {
			if (err) {
				return res.status(500).json({ error: "خطا در ثبت نام" });
			}

			const userId = result.insertId;

			// Retrieve data from 'airdropSubTitle' table and convert to object
			db.query("SELECT * FROM airdropSubTitle", (err, rows) => {
				if (err) {
					return res
						.status(500)
						.json({ error: "خطا در دریافت اطلاعات" });
				}

				const airdropCards = rows.map((row) => ({
					airdropSTId: row.airdropSTId,
					cardName: row.cardName,
					profit: row.profit,
					coin: row.coin,
					category: row.category,
					cardImg: row.cardImg,
				}));

				// Save object in 'hamsterCards' table
				db.query(
					`INSERT INTO hamsterCards (userID, hamsterCards) VALUES (?, ?)`,
					[userId, JSON.stringify(airdropCards)],
					(err) => {
						if (err) {
							return res
								.status(500)
								.json({ error: "خطا در ذخیره کارت‌ها" });
						}

						res.json({ message: "ثبت نام با موفقیت انجام شد" });
					}
				);
			});
		}
	);
});

//********************** Login ******************************************************** */
// Login endpoint
app.post("/login", (req, res) => {
	const { email, password } = req.body;

	// Check if user exists in database
	db.query(
		`
        SELECT * FROM users
        WHERE email = ? AND password = ?
        `,
		[email, password],
		(err, rows) => {
			if (err) {
				console.error(err.message);
				res.status(500).json({ error: "Error querying database" });
			} else if (rows.length > 0) {
				res.status(200).json({
					message: "Login successful",
					user: rows[0],
				});
			} else {
				res.status(404).json({ error: "User not found" });
			}
		}
	);
});
//************************************************************************************** */
// Airdrops endpoint to fetch all records from 'airdrops' table
app.get("/airdrops", (req, res) => {
	db.query("SELECT * FROM airdrops", (err, rows) => {
		if (err) {
			console.error(err.message);
			res.status(500).json({ error: "Error querying airdrops" });
		} else {
			res.status(200).json(rows);
		}
	});
});

// Update user endpoint
app.put("/update-user", (req, res) => {
	const { userID, gender, phone } = req.body;

	db.query(
		`
        UPDATE users
        SET userGender = ?, userMNr = ?
        WHERE userID = ?
    `,
		[gender, phone, userID],
		(err, result) => {
			if (err) {
				console.error(err.message);
				res.status(500).json({
					error: "Error updating user in database",
				});
			} else {
				res.status(200).json({ message: "User updated successfully" });
			}
		}
	);
});

// Endpoint for retrieving data from 'airdropSubTitle' table
app.get("/api/airdropSubTitle", (req, res) => {
	db.query("SELECT * FROM airdropSubTitle", (err, rows) => {
		if (err) {
			console.error(err.message);
			res.status(500).json({ error: "Error querying airdropSubTitle" });
		} else {
			res.status(200).json(rows);
		}
	});
});

// Endpoint for getting row count of 'airdropSubTitle' table
app.get("/api/airdropSubTitle/count", (req, res) => {
	db.query("SELECT COUNT(*) AS count FROM airdropSubTitle", (err, rows) => {
		if (err) {
			console.error(err.message);
			res.status(500).json({ error: "Error querying airdropSubTitle" });
		} else {
			res.status(200).json({ count: rows[0].count });
		}
	});
});

// Endpoint for fetching 'hamsterCards' information based on userID
app.get("/hamsterCards/:userID", (req, res) => {
	const userID = req.params.userID;

	db.query(
		`SELECT hamsterCards FROM hamsterCards WHERE userID = ?`,
		[userID],
		(err, rows) => {
			if (err) {
				return res
					.status(500)
					.json({ error: "خطا در دریافت اطلاعات کارت‌ها" });
			}

			if (rows.length === 0) {
				return res
					.status(404)
					.json({
						error: "کاربر یافت نشد یا هنوز کارتی ثبت نکرده است",
					});
			}

			const hamsterCards = JSON.parse(rows[0].hamsterCards);
			res.json(hamsterCards);
		}
	);
});

//***************************************************************************** */
// Update hamster cards route
app.post("/updateHamsterCard", (req, res) => {
	const { userId, updatedCardList } = req.body;

	// Check if userId and updatedCardList are provided
	if (!userId || !updatedCardList) {
		return res
			.status(400)
			.json({ error: "userId and updatedCardList are required" });
	}

	// Update the hamster cards for the user in the database
	db.query(
		`UPDATE hamsterCards
        SET hamsterCards = ?
        WHERE userID = ?`,
		[JSON.stringify(updatedCardList), userId],
		(err) => {
			if (err) {
				console.error("Error updating hamster cards:", err.message);
				return res
					.status(500)
					.json({ error: "Failed to update hamster cards" });
			}

			// Fetch updated hamster cards for the user
			db.query(
				`SELECT hamsterCards FROM hamsterCards WHERE userID = ?`,
				[userId],
				(err, rows) => {
					if (err) {
						console.error(
							"Error fetching updated hamster cards:",
							err.message
						);
						return res
							.status(500)
							.json({
								error: "Failed to fetch updated hamster cards",
							});
					}
					res.json(JSON.parse(rows[0].hamsterCards));
				}
			);
		}
	);
});

/*********************************************************************************************** */
// Endpoint for updating 'hamsterCards' table
app.post("/api/updateHamsterCards", async (req, res) => {
	const { userID, hamsterCards } = req.body;

	try {
		const placeholders = hamsterCards.map(() => "(?, ?, ?)").join(",");
		const values = [];
		hamsterCards.forEach((card) => {
			values.push(userID, card.airdropSTId, JSON.stringify(card));
		});

		const query = `
            INSERT INTO hamsterCards (userID, airdropSTId, hamsterCards)
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE hamsterCards = VALUES(hamsterCards)
        `;

		db.query(query, values, (err) => {
			if (err) {
				console.error(err);
				return res
					.status(500)
					.json({ message: "Error updating hamster cards" });
			}

			res.status(200).json({
				message: "Hamster cards updated successfully",
			});
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Error updating hamster cards" });
	}
});

// Start server
app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
