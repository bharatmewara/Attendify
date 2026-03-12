import React from "react";
import { Paper, Typography, Box } from "@mui/material";

const StatCard = ({ title, value }) => {
  return (
    <Paper
      elevation={3}
      sx={{
        padding: 3,
        borderRadius: 3,
        transition: "0.3s",
        "&:hover": {
          transform: "translateY(-5px)"
        }
      }}
    >
      <Typography color="gray">{title}</Typography>

      <Typography variant="h4" fontWeight="bold">
        {value}
      </Typography>
    </Paper>
  );
};

export default StatCard;