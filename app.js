const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeAndDbAndServer = async () => {
  try {
    db = await open({ filename: databasePath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log(`server is running on http://localhost:3000`);
    });
  } catch (error) {
    console.log(`Database error is ${error}`);
    process.exit(1);
  }
};

initializeAndDbAndServer();

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser !== undefined) {
    const isPasswordValid = await bcrypt.compare(password, dbUser.password);
    if (isPasswordValid) {
      //get JWT Token
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken }); //Scenario 3
    } else {
      response.status(400);
      response.send(`Invalid password`); //Scenario 2
    }
  } else {
    response.status(400);
    response.send("Invalid user"); //Scenario 1
  }
});

//AUTHENTICATE TOKEN
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`); // Scenario 1
      } else {
        next(); //Scenario 2
      }
    });
  } else {
    response.status(401);
    response.send(`Invalid JWT Token`); //Scenario 1
  }
};

const convertStateDbObject = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  console.log("books api");
  const getBooksQuery = `
    SELECT
    *
    FROM
    state
    `;
  const booksArray = await db.all(getBooksQuery);
  console.log(booksArray);
  response.send(booksArray.map((eachState) => convertStateDbObject(eachState)));
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getBookQuery = `
 SELECT
 *
 FROM
 state
 WHERE
 state_id = ${stateId};
 `;
  const book = await db.get(getBookQuery);
  response.send(convertStateDbObject(book));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createUserQuery = `
    INSERT INTO
    district (district_name, state_id, cases, cured, active, deaths)
    VALUES
    (
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
    )`;
  await db.run(createUserQuery);
  response.send(`District Successfully Added`);
});

const convertDbObjectDistrict = (objectItem) => {
  return {
    districtId: objectItem.district_id,
    districtName: objectItem.district_name,
    stateId: objectItem.state_id,
    cases: objectItem.cases,
    cured: objectItem.cured,
    active: objectItem.active,
    deaths: objectItem.deaths,
  };
};

//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getBooksQuery = `
    SELECT
    *
    FROM
    district
    where
    district_id = ${districtId};`;
    const booksArray = await db.get(getBooksQuery);
    response.send(convertDbObjectDistrict(booksArray));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getBooksQuery = `
    delete
    FROM
    district
    where
    district_id = ${districtId};`;
    const booksArray = await db.run(getBooksQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const getBooksQuery = `
    update
    district
    set
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    where
    district_id = ${districtId};`;
    const booksArray = await db.run(getBooksQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getBooksQuery = `
    select
    sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths
    from district
    where
    state_id = ${stateId};`;
    const booksArray = await db.get(getBooksQuery);
    response.send(booksArray);
  }
);

module.exports = app;
