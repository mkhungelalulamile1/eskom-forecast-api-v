import {
  AssessmentRounded,
  LogoutRounded,
  TimelineRounded,
  MemoryRounded,
} from "@mui/icons-material";

import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";

import { NavLink } from "react-router-dom";

import { ROUTES } from "../../routes/routes";

import logo from "../../assets/Eskom-logo-white.gif";



const navigation = [

  {
    title: "Forecast",
    icon: TimelineRounded,
    path: ROUTES.FORECAST,
  },

  {
    title: "Model Performance",
    icon: AssessmentRounded,
    path: ROUTES.MODEL_PERFORMANCE,
  },

  {
    title: "Inference Monitoring",
    icon: MemoryRounded,
    path: ROUTES.INFERENCE,
  },

];



const DashboardSidebar = () => {

return (

<Box

sx={{

width:300,

height:"100vh",

bgcolor:"#101D2D",

color:"#fff",

display:"flex",

flexDirection:"column",

borderRight:"1px solid rgba(255,255,255,.08)",

}}

>


{/* Logo */}

<Box

sx={{

px:4,

py:5,

}}

>


<Box

component="img"

src={logo}

alt="Eskom"

sx={{

width:180,

mb:2,

}}

 />



<Typography

variant="body2"

sx={{

color:"rgba(255,255,255,.65)",

}}

>

Forecast Management Platform

</Typography>


</Box>





{/* Navigation */}

<List

sx={{

px:2,

flex:1,

}}

>


{
navigation.map((item)=>{


const Icon = item.icon;


return (

<ListItemButton

key={item.path}

component={NavLink}

to={item.path}

sx={{

borderRadius:4,

mb:1,

py:1.5,


"&.active":{

bgcolor:"#1E5EFF",

},


"&:hover":{

bgcolor:"rgba(255,255,255,.08)",

},

}}

>


<ListItemIcon

sx={{

color:"inherit",

minWidth:46,

}}

>

<Icon />

</ListItemIcon>



<ListItemText

primary={item.title}

primaryTypographyProps={{

fontWeight:600,

}}

/>


</ListItemButton>

);

})

}


</List>





{/* Footer */}

<Box

sx={{

p:3,

}}

>


<ListItemButton

sx={{

borderRadius:4,

}}

>


<ListItemIcon

sx={{

color:"#fff",

}}

>

<LogoutRounded />

</ListItemIcon>



<ListItemText

primary="Logout"

/>


</ListItemButton>


</Box>


</Box>

);

};


export default DashboardSidebar;