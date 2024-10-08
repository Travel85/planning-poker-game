import Paper from "@mui/material/Paper";
import { Box } from "@mui/material";
import { socket } from "../components/socket";
import { toast } from "react-toastify";
import Tooltip from "@mui/material/Tooltip";

export const VoteButton = ({ value, imgSource, sessionIdVar, tooltipText }) => {
  //emits the value of the voting card to the backend for the current user
  const handleClick = () => {
    //  console.log(`Vote: ${Number(value)}`);
    const localUserId = localStorage.getItem("userId");
    socket.emit("updateVote", {
      userId: localUserId,
      voteResult: value,
      sessionId: sessionIdVar,
    });
    toast.success(`Voted ${value} Story Points!`);
  };
  return (
    <Tooltip title={tooltipText} arrow>
      <Box onClick={handleClick}>
        <Paper
          elevation={2}
          sx={{
            "&:hover": {
              boxShadow: 15,
              cursor: "pointer",
              transform: "scale(1.1, 1.1)",
            },
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: 153,
            height: 228,
            m: 1,
            border: "1px solid black",
            borderRadius: "5%",
            backgroundColor: "#000000",
          }}>
          <img
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "5%",
              objectFit: "contain",
            }}
            src={imgSource}></img>
        </Paper>
      </Box>
    </Tooltip>
  );
};
