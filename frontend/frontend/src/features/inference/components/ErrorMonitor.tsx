import {
  CheckCircleRounded,
  ErrorRounded,
  WarningRounded,
} from "@mui/icons-material";


import {
  Avatar,
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";


import AppCard from "../../../components/common/AppCard";
import CardHeader from "../../../components/common/CardHeader";



interface SystemError {

  time:string;

  component:string;

  message:string;

  severity:
    | "Critical"
    | "Warning"
    | "Resolved";

  status:string;

}



const errors:SystemError[] = [

  {
    time:"10:34",
    component:"Database",
    message:"Unable to store inference results",
    severity:"Critical",
    status:"Open",
  },


  {
    time:"10:20",
    component:"Forecast API",
    message:"Slow response from prediction endpoint",
    severity:"Warning",
    status:"Investigating",
  },


  {
    time:"09:45",
    component:"Weather Service",
    message:"Weather data retrieval timeout",
    severity:"Resolved",
    status:"Resolved",
  },

];





const ErrorMonitor = () => {


return (

<AppCard
sx={{
p:4,
}}
>


<CardHeader

title="System Errors & Alerts"

subtitle="Monitoring failures, warnings and resolved incidents"

/>



<Stack
spacing={2}
mt={4}
>


{
errors.map((error)=>(


<Box

key={`${error.time}-${error.component}`}

sx={{

p:3,

border:"1px solid",

borderColor:"divider",

borderRadius: "12px",

}}

>


<Stack

direction={{
xs:"column",
md:"row",
}}

spacing={3}

alignItems={{
md:"center",
}}

>



<Avatar

sx={{

bgcolor:

error.severity==="Critical"

?

"#FDECEC"

:

error.severity==="Warning"

?

"#FFF8E1"

:

"#E8F5E9",



color:

error.severity==="Critical"

?

"error.main"

:

error.severity==="Warning"

?

"warning.main"

:

"success.main",

}}

>


{
error.severity==="Critical"

?

<ErrorRounded />

:

error.severity==="Warning"

?

<WarningRounded />

:

<CheckCircleRounded />

}


</Avatar>





<Box
flex={1}
>


<Typography
fontWeight={700}
>

{error.component}

</Typography>


<Typography
variant="body2"
color="text.secondary"
>

{error.message}

</Typography>


</Box>





<Box>

<Typography
variant="caption"
color="text.secondary"
>

Time

</Typography>


<Typography
fontWeight={600}
>

{error.time}

</Typography>


</Box>





<Chip

label={error.severity}

size="small"

color={

error.severity==="Critical"

?

"error"

:

error.severity==="Warning"

?

"warning"

:

"success"

}

/>



<Chip

label={error.status}

size="small"

variant="outlined"

/>



</Stack>


</Box>


))
}


</Stack>


</AppCard>

);

};


export default ErrorMonitor;