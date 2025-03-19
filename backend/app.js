const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { default: mongoose } = require("mongoose");
const cors = require("cors");
const { type } = require("os");
const app = express();
const httpServer = createServer(app);
const { v4: uuidv4 } = require("uuid");
const winstonLogger = require("./logging");
const fs = require("fs");
const path = require("path");
const connectDB = require("./connectDB");
const UserSessionEntry = require("./models/userSession");
const session = require("express-session");

const adminPage = require("./routes/adminPage");

// Configure session middleware
const sessionMiddleware = session({
  name: "sessionId", // Custom session ID name
  secret: process.env.SESSION_SECRET || "your-secret-string",
  resave: true,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  },
});
app.use(sessionMiddleware);

const logPath = "./logs";
fs.mkdirSync(logPath, { recursive: true });

require("dotenv").config();
const PORT = process.env.PORT || 3000;

// CORS configuration for Express
const corsOptions = {
  origin: `${process.env.FRONTEND_URL}`,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Error handling middleware
app.use((err, req, res, next) => {
  winstonLogger.error({
    message: err.message,
    stack: err.stack,
  });
  res.status(500).send("Something broke!");
});

// Add request logging middleware
app.use((req, res, next) => {
  winstonLogger.info(`${req.method} ${req.url}`);
  next();
});

const io = new Server(httpServer, {
  /* options */
  path: "/api/session/",
  cors: corsOptions,
  // connectionStateRecovery: {
  //   // the backup duration of the sessions and the packets
  //   maxDisconnectionDuration: 2 * 60 * 1000,
  //   // whether to skip middlewares upon successful recovery
  //   skipMiddlewares: true,
  // },
});

// Share session context with Socket.IO
io.engine.use(sessionMiddleware);

// Call the connection function to connect to Mongo DB
connectDB();

app.get("/", (req, res) => {
  res.send("Backend has started!");
});

//route to admin page
app.use("/admin", adminPage);

httpServer.listen(PORT, () => {
  console.log(`Example app listening on PORT ${PORT}`);
});

io.on("connection", (socket) => {
  console.log("a user connected with ID" + socket.id);
  winstonLogger.info(`a user connected with ID ${socket.id}`);

  //listen to emit from frontend to create a new session id
  socket.on("createSessionId", async () => {
    // Get the session from express-session
    const session = socket.request.session;
    console.log(`New session ${session} created`);
    winstonLogger.info(`New session ${session} created`);

    // Use express-session's ID instead of generating a new one
    const sessionId = session.id;
    await session.save();
    //const sessionId = uuidv4();
    console.log(`sessionId generated with Id: ${sessionId}`);
    winstonLogger.info(`sessionId generated with Id: ${sessionId}`);
    socket.emit("sessionIdGenerated", { sessionId: sessionId });
  });

  //listens to emits from frontend if user joins a room, then create a new entry in database with all user data
  //then load updated data from database end emit it to frontend as "updateData"
  socket.on("join-room", async (msg) => {
    socket.join(msg.sessionId);
    console.log(
      `Message received: ${msg.userId}, ${msg.username}, ${msg.sessionId}, ${msg.role}, ${msg.voteResult}`
    );
    winstonLogger.info(
      `Message received: ${msg.userId}, ${msg.username}, ${msg.sessionId}, ${msg.role}, ${msg.voteResult}`
    );

    const userExist = await UserSessionEntry.findOne({ userId: msg.userId });

    //delete all data
    // const result = await UserSessionEntry.deleteMany({});
    // console.log(`Deleted ${result.deletedCount} documents`);

    // const emptySession = await UserSessionEntry.findOne({
    //   sessionId: "",
    //   role: "productmanager",
    // });
    // console.log(`empty session: ${emptySession}`);

    try {
      if (!userExist) {
        const newEntry = new UserSessionEntry({
          sessionId: msg.sessionId,
          userId: msg.userId,
          socketId: socket.id,
          username: msg.username,
          role: msg.role,
          voteResult: msg.voteResult,
        });

        await newEntry.save();
        console.log("New user saved to database");
        winstonLogger.info(
          "New user saved to database: " + JSON.stringify(newEntry)
        );

        const sessionData = await UserSessionEntry.find({
          sessionId: msg.sessionId,
        });
        console.log(`Session Data from DB of current session: ${sessionData}`);
        winstonLogger.info(
          `Session Data from DB of current session: ${JSON.stringify(
            sessionData
          )}`
        );
        io.to(msg.sessionId).emit("updateData", {
          users: sessionData,
        });
      }
      // else {
      //   const updatedUser = await UserSessionEntry.findOneAndUpdate(
      //     { sessionId: "", role: "productmanager" },
      //     {
      //       $set: {
      //         sessionId: msg.sessionId,
      //       },
      //     },
      //     { new: true, upsert: true }
      //   );

      //   if (!updatedUser) {
      //     throw new Error("Failed to update or insert user");
      //   }

      //   console.log("User data updated or inserted successfully");

      //   const sessionData = await UserSessionEntry.find({
      //     sessionId: msg.sessionId,
      //   });
      //   console.log(`Session Data from DB of current session: ${sessionData}`);

      //   io.to(msg.sessionId).emit("updateData", { users: sessionData });
      // }
    } catch (error) {
      console.log(`error saving message: ${error}`);
      winstonLogger.error({
        message: "error saving message:",
        stack: error.stack,
      });
    }
  });

  //listens to socket from frontend to get an organizer. Look in database for current session id and role = productmanager
  //emit the organizer name to frontend
  socket.on("getOrganizer", async (msg) => {
    console.log(`session id from frontend to get organizer: ${msg.sessionId}`);
    winstonLogger.info(
      `session id from frontend to get organizer: ${msg.sessionId}`
    );
    try {
      const organizer = await UserSessionEntry.findOne({
        sessionId: msg.sessionId,
        role: "productmanager",
      });

      if (!organizer) {
        console.log("No organizer found in database");
        //  winstonLogger.error("No organizer found in database");
        return;
      }
      console.log(`Organizer from database: ${organizer.username}`);
      winstonLogger.info(`Organizer from database: ${organizer.username}`);
      io.to(msg.sessionId).emit("setOrganizer", {
        username: organizer.username,
      });
    } catch (error) {
      console.log(`error receiving Organizer: ${error}`);
      winstonLogger.error({
        message: "error receiving Organizer:",
        stack: error.stack,
      });
    }
  });

  //listens to socket from fontent to get observers. Look in the database for current session id and role = observer
  //emit the observer list to frontend
  socket.on("getObservers", async (msg) => {
    console.log(`session id from frontend to get observer: ${msg.sessionId}`);
    winstonLogger.info(
      `session id from frontend to get observer: ${msg.sessionId}`
    );
    try {
      const observers = await UserSessionEntry.find({
        sessionId: msg.sessionId,
        role: "observer",
      });
      console.log(`Observer list from DB of current session: ${observers}`);
      winstonLogger.info(
        `Observer list from DB of current session: ${JSON.stringify(observers)}`
      );
      io.to(msg.sessionId).emit("setObservers", { users: observers });
    } catch (error) {
      console.log(`error receving data: ${error}`);
      winstonLogger.error({
        message: "error receiving data:",
        stack: error.stack,
      });
    }
  });

  //listen to socket from frontend to check for duplicate users. Look in database for current session id and username
  //emit true/false to frontend
  socket.on("checkUsername", async (msg) => {
    console.log(
      `session id ${msg.sessionId} from frontend to look for duplicate username ${msg.username}`
    );
    winstonLogger.info(
      `session id ${msg.sessionId} from frontend to look for duplicate username ${msg.username}`
    );
    try {
      const duplicateUsername = await UserSessionEntry.findOne({
        sessionId: msg.sessionId,
        username: msg.username,
      });
      if (duplicateUsername) {
        console.log(
          `Duplicate username found in DB: username frontend: ${msg.username} matches DB element: ${duplicateUsername}`
        );
        winstonLogger.info(
          `Duplicate username found in DB: username frontend: ${msg.username} matches DB element: ${duplicateUsername}`
        );
        socket.emit("UsernameChecked", { foundDuplicateUser: true });
      } else {
        socket.emit("UsernameChecked", { foundDuplicateUser: false });
      }
    } catch (error) {
      console.log(`error receving data: ${error}`);
      winstonLogger.error({
        message: "error receiving data:",
        stack: error.stack,
      });
    }
  });

  //listen to socket from frontend to check for valid session id. Look in database for valid session id
  //emit true/false to frontend
  socket.on("checkSessionId", async (msg) => {
    console.log(
      `session id ${msg.sessionId} from frontend to look for valid session id in DB`
    );
    winstonLogger.info(
      `session id ${msg.sessionId} from frontend to look for valid session id in DB`
    );
    try {
      const validSessionId = await UserSessionEntry.findOne({
        sessionId: msg.sessionId,
      });
      if (validSessionId) {
        console.log(
          `Found valid session ID in Backend. ${msg.sessionId} matches session ID ${validSessionId} in DB`
        );
        winstonLogger.info(
          `Found valid session ID in Backend. ${msg.sessionId} matches session ID ${validSessionId} in DB`
        );
        socket.emit("SessionIdChecked", { foundValidSessionId: true });
      } else {
        console.log(
          `Session ID not found in Backend. ${msg.sessionId} does not matches session ID ${validSessionId} in DB`
        );
        winstonLogger.info(
          `Session ID not found in Backend. ${msg.sessionId} does not matches session ID ${validSessionId} in DB`
        );
        socket.emit("SessionIdChecked", { foundValidSessionId: false });
      }
    } catch (error) {
      console.log(`error receving data: ${error}`);
      winstonLogger.error({
        message: "error receiving data:",
        stack: error.stack,
      });
    }
  });

  //listen to socket with votes from frontend. Update database for current user with vote result and set hasVoted status to true
  //then load updated data from database end emit it to frontend as "updateData"
  socket.on("updateVote", async (msg) => {
    try {
      const sessionData = await UserSessionEntry.findOneAndUpdate(
        {
          userId: msg.userId,
        },
        { voteResult: msg.voteResult, hasVoted: true }
      );

      const newSessionData = await UserSessionEntry.find({
        sessionId: msg.sessionId,
      });
      console.log(`Session Data from DB of current session: ${sessionData}`);
      winstonLogger.info(
        `Session Data from DB of current session: ${sessionData}`
      );
      io.to(msg.sessionId).emit("updateData", {
        users: newSessionData,
      });
    } catch (error) {
      console.log(`error receving data: ${error}`);
      winstonLogger.error({
        message: "error receiving data:",
        stack: error.stack,
      });
    }
  });

  //listen to sockets for reseted votes. Then reset all votes for current session id in database and set vote status false
  //listen to socket with votes from frontend. Update database for current user with vote result and set hasVoted status to true
  //then load updated data from database end emit it to frontend as "updateData"
  socket.on("resetVote", async (msg) => {
    try {
      const sessionData = await UserSessionEntry.updateMany(
        { sessionId: msg.sessionId },
        {
          voteResult: 0,
          hasVoted: false,
        }
      );

      const newSessionData = await UserSessionEntry.find({
        sessionId: msg.sessionId,
      });
      console.log(`Session Data from DB of current session: ${sessionData}`);
      winstonLogger.info(
        `Session Data from DB of current session: ${JSON.stringify(
          sessionData
        )}`
      );
      io.to(msg.sessionId).emit("updateData", {
        users: newSessionData,
      });
      io.to(msg.sessionId).emit("votesResetted", {});
    } catch (error) {
      console.log(`Error resetting: ${error}`);
      winstonLogger.error({
        message: "Error resetting:",
        stack: error.stack,
      });
    }
  });

  //listen to sockets to check backend if every user has voted
  socket.on("checkHasVoted", async (msg) => {
    try {
      const sessionData = await UserSessionEntry.findOne({
        sessionId: msg.sessionId,
        role: "developer",
        hasVoted: false,
      });
      if (sessionData) {
        console.log("not all user have voted");
        winstonLogger.info("not all user have voted");
        io.to(msg.sessionId).emit("hasVoted", { userHasVoted: false });
      } else {
        console.log("All users have voted.");
        winstonLogger.info("All users have voted.");
        io.to(msg.sessionId).emit("hasVoted", { userHasVoted: true });
      }
    } catch (error) {
      console.log(`Error checking status: ${error}`);
      winstonLogger.error({
        message: "Error checking status:",
        stack: error.stack,
      });
    }
  });

  //listen to sockets to show votes and emit socket to frontend
  socket.on("showVotes", (msg) => {
    io.to(msg.sessionId).emit("votesShown", {});
  });

  //listen to sockets to kick user from session. Look in database for current session id and user id
  //delete user from database and load updated data from database end emit it to frontend as "updateData"
  socket.on("kickUser", async (msg) => {
    try {
      const userSocket = io.sockets.sockets.get(msg.socketId);
      if (userSocket) {
        userSocket.leave(msg.sessionId);
      }
      userSocket.emit("kicked", {
        message: "You have been removed from the session!",
      });

      await UserSessionEntry.deleteOne({ userId: msg.userId });
      console.log(`User with ID ${msg.userId} has been kicked from session`);
      winstonLogger.info(
        `User with ID ${msg.userId} has been kicked from session`
      );

      const newSessionData = await UserSessionEntry.find({
        sessionId: msg.sessionId,
      });

      io.to(msg.sessionId).emit("updateData", {
        users: newSessionData,
      });
    } catch (error) {
      console.log(`Error kicking user: ${error}`);
      winstonLogger.error({
        message: "Error kicking user:",
        stack: error.stack,
      });
    }
  });

  //try to remove users who have left the session from database
  socket.on("disconnect", async () => {
    try {
      const currentSessionId = await UserSessionEntry.findOne({
        socketId: socket.id,
      });
      const newSessionData = await UserSessionEntry.find({
        sessionId: currentSessionId.sessionId,
      });

      io.to(currentSessionId.sessionId).emit("updateData", {
        users: newSessionData,
      });
    } catch (error) {
      console.log(`error removing user: ${error}`);
      winstonLogger.error({
        message: "Error removing user:",
        stack: error.stack,
      });
    }

    await UserSessionEntry.deleteOne({ socketId: socket.id });
    console.log(`Client disconnected, deleting id ${socket.id}from DB`);
    winstonLogger.info(`Client disconnected, deleting id ${socket.id}from DB`);
  });
});
