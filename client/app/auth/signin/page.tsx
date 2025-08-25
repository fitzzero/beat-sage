"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Divider,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleCredentialsAuth = async (action: "signin" | "signup") => {
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        action,
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.error === "CredentialsSignin"
            ? action === "signup"
              ? "User already exists"
              : "Invalid credentials"
            : result.error
        );
      } else {
        // Refresh session to get the user data
        await getSession();
        router.push("/");
      }
    } catch (_err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError("");

    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (_err) {
      setError("Google authentication failed");
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box mt={8} mb={4}>
        <Paper elevation={3}>
          <Box p={4}>
            <Typography variant="h4" component="h1" gutterBottom align="center">
              Welcome to Beat Sage
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              align="center"
              gutterBottom
              sx={{ mb: 3 }}
            >
              Rhythm-based cultivation game
            </Typography>

            {/* Google Sign In */}
            <Button
              fullWidth
              variant="outlined"
              startIcon={<GoogleIcon />}
              onClick={handleGoogleAuth}
              disabled={loading}
              sx={{ mb: 2 }}
            >
              Continue with Google
            </Button>

            <Divider sx={{ my: 2 }}>or</Divider>

            {/* Email/Password Form */}
            <Box component="form" onSubmit={(e) => e.preventDefault()}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
                helperText={"For demo purposes, any password is accepted"}
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Sign In Button */}
              <Button
                fullWidth
                variant="contained"
                onClick={() => handleCredentialsAuth("signin")}
                disabled={loading}
                sx={{ mt: 3, mb: 1 }}
              >
                {loading ? "Loading..." : "Sign In"}
              </Button>

              {/* Register Button */}
              <Button
                fullWidth
                variant="outlined"
                onClick={() => handleCredentialsAuth("signup")}
                disabled={loading}
                sx={{ mt: 1 }}
              >
                {loading ? "Loading..." : "Create Account"}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
