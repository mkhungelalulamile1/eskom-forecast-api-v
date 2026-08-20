import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import LoginButton from "./LoginButton";
import { ROUTES } from "../../routes/routes";


const LoginForm = () => {


  const navigate = useNavigate();


  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");

  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);




  const handleSubmit = async (
    e: React.FormEvent
  ) => {

    e.preventDefault();


    setLoading(true);



    // Temporary authentication simulation

    await new Promise((resolve) =>
      setTimeout(resolve, 800)
    );



    console.log({

      username,

      password,

      remember,

    });



    /*
      Replace later with:

      const response =
        await authService.login(
          username,
          password
        );

    */



    setLoading(false);



    // Redirect to main dashboard section

    navigate(ROUTES.FORECAST);


  };




  return (

    <Box

      component="form"

      onSubmit={handleSubmit}

      sx={{

        width:"100%",

      }}

    >


      <Typography

        sx={{

          fontSize:38,

          fontWeight:700,

          color:"text.primary",

        }}

      >

        Welcome Back


      </Typography>




      <Typography

        sx={{

          color:"#6B7280",

          mt:1,

          mb:5,

          fontSize:16,

        }}

      >

        Sign in to access the Eskom Forecast Management Platform.


      </Typography>





      <Stack spacing={3.5}>


        <Box>


          <Typography

            sx={{

              mb:1,

              fontWeight:600,

              color:"#374151",

            }}

          >

            Username

          </Typography>



          <TextField

            fullWidth

            placeholder="Enter username"

            value={username}

            onChange={(e)=>
              setUsername(e.target.value)
            }

            InputProps={{

              sx:{

                height:58,

                borderRadius:3,

                bgcolor:"#FAFBFC",

              },

            }}

          />


        </Box>





        <Box>


          <Typography

            sx={{

              mb:1,

              fontWeight:600,

              color:"#374151",

            }}

          >

            Password

          </Typography>




          <TextField

            fullWidth

            type="password"

            placeholder="Enter password"

            value={password}

            onChange={(e)=>
              setPassword(e.target.value)
            }


            InputProps={{

              sx:{

                height:58,

                borderRadius:3,

                bgcolor:"#FAFBFC",

              },

            }}

          />


        </Box>





        <Stack

          direction="row"

          justifyContent="space-between"

          alignItems="center"

        >


          <FormControlLabel

            control={

              <Checkbox

                checked={remember}

                onChange={(e)=>
                  setRemember(
                    e.target.checked
                  )
                }

              />

            }

            label="Remember me"

          />



          <Link

            href="#"

            underline="hover"

            sx={{

              fontWeight:600,

              color:"primary.main",

            }}

          >

            Forgot Password?

          </Link>


        </Stack>





        <LoginButton

          loading={loading}

        />





        <Divider />





        <Typography

          align="center"

          color="text.secondary"

          sx={{

            fontSize:14,

          }}

        >

          Eskom Forecast Management System

          <br />

          Version 1.0


        </Typography>


      </Stack>


    </Box>

  );

};


export default LoginForm;