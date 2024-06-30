const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();


const app = express();
const port = process.env.PORT || 3000;



app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Enable CORS for specific origins and methods
app.use(
	cors({
		origin: ["http://localhost:4000", "http://localhost:3001"],
		methods: ["GET", "POST", "PUT"],
		allowedHeaders: ["Content-Type"],
	})
);

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// SQLite database setup
const dbPath = "./database.db"; // Path to your SQLite database file
const db = new sqlite3.Database(dbPath, (err) => {
	if (err) {
		console.error("Database connection error:", err.message);
	} else {
		console.log("Connected to the SQLite database.");
	}
});

// ************************* Register ************************************************************
app.get("/", (req, res) => {
	res.sendFile(__dirname + "/index.html");
});


app.post("/register", (req, res) => {
	const { userName, email, password, userGender, userMNr } = req.body;

	// ذخیره اطلاعات کاربر در جدول users
	db.run(
		`INSERT INTO users (userName, email, password, userGender, userMNr) VALUES (?, ?, ?, ?, ?)`,
		[userName, email, password, userGender, userMNr],
		function (err) {
			if (err) {
				return res.status(500).json({ error: "خطا در ثبت نام" });
			}

			const userId = this.lastID;

			// دریافت داده‌ها از جدول airdropSubTitle و تبدیل به آبجکت
			db.all("SELECT * FROM airdropSubTitle", [], (err, rows) => {
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

				// ذخیره آبجکت در جدول hamsterCards
				db.run(
					`INSERT INTO hamsterCards (userID, hamsterCards) VALUES (?, ?)`,
					[userId, JSON.stringify(airdropCards)],
					function (err) {
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
	db.get(
		`
      SELECT * FROM users
      WHERE email = ? AND password = ?
      `,
		[email, password],
		(err, row) => {
			if (err) {
				console.error(err.message);
				res.status(500).json({ error: "Error querying database" });
			} else if (row) {
				res.status(200).json({
					message: "Login successful",
					user: row,
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
	db.all("SELECT * FROM airdrops", (err, rows) => {
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

	const stmt = db.prepare(`
      UPDATE users
      SET userGender = ?, userMNr = ?
      WHERE userID = ?
  `);

	stmt.run(gender, phone, userID, function (err) {
		if (err) {
			console.error(err.message);
			res.status(500).json({ error: "Error updating user in database" });
		} else {
			res.status(200).json({ message: "User updated successfully" });
		}
	});
	stmt.finalize();
});


// ایجاد endpoint برای دریافت داده‌ها از جدول airdropSubTitle
app.get("/api/airdropSubTitle", (req, res) => {
	db.all("SELECT * FROM airdropSubTitle", (err, rows) => {
		if (err) {
			console.error(err.message);
			res.status(500).json({ error: "Error querying airdropSubTitle" });
		} else {
			res.status(200).json(rows);
		}
	});
});

// endpoint برای دریافت تعداد سطرهای جدول airdropSubTitle
app.get("/api/airdropSubTitle/count", (req, res) => {
	db.get("SELECT COUNT(*) AS count FROM airdropSubTitle", (err, row) => {
		if (err) {
			console.error(err.message);
			res.status(500).json({ error: "Error querying airdropSubTitle" });
		} else {
			res.status(200).json({ count: row.count });
		}
	});
});

// Endpoint برای دریافت اطلاعات مربوط به hamsterCards بر اساس userID
app.get('/hamsterCards/:userID', (req, res) => {
    const userID = req.params.userID;

    db.get(`SELECT hamsterCards FROM hamsterCards WHERE userID = ?`, [userID], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'خطا در دریافت اطلاعات کارت‌ها' });
        }

        if (!row) {
            return res.status(404).json({ error: 'کاربر یافت نشد یا هنوز کارتی ثبت نکرده است' });
        }

        const hamsterCards = JSON.parse(row.hamsterCards);
        res.json(hamsterCards);
    });
});
//***************************************************************************** */
// Update hamster cards route
app.post('/updateHamsterCard', (req, res) => {
    const { userId, updatedCardList } = req.body;

    // Check if userId and updatedCardList are provided
    if (!userId || !updatedCardList) {
        return res.status(400).json({ error: 'userId and updatedCardList are required' });
    }

    // Update the hamster cards for the user in the database
    db.run(`UPDATE hamsterCards
            SET hamsterCards = $hamsterCards
            WHERE userID = $userId`,
        {
            $userId: userId,
            $hamsterCards: updatedCardList,
        },
        function (err) {
            if (err) {
                console.error('Error updating hamster cards:', err.message);
                return res.status(500).json({ error: 'Failed to update hamster cards' });
            }

            // Fetch updated hamster cards for the user
            db.get(`SELECT hamsterCards FROM hamsterCards WHERE userID = ?`, [userId], (err, row) => {
                if (err) {
                    console.error('Error fetching updated hamster cards:', err.message);
                    return res.status(500).json({ error: 'Failed to fetch updated hamster cards' });
                }
                res.json(JSON.parse(row.hamsterCards));
            });
        });
});
/*********************************************************************************************** */
// ایجاد endpoint برای به‌روزرسانی جدول hamsterCards
app.post("/api/updateHamsterCards", async (req, res) => {
	const { userID, hamsterCards } = req.body;

	try {
		const placeholders = hamsterCards.map(() => "(?, ?, ?)").join(",");
		const values = [];
		hamsterCards.forEach((card) => {
			values.push(userID, card.airdropSTId, JSON.stringify(card));
		});

		const query = `
      INSERT OR REPLACE INTO hamsterCards (userID, airdropSTId, hamsterCards)
      VALUES ${placeholders}
    `;

		db.run(query, values, function (err) {
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