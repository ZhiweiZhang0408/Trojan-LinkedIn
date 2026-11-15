import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Avatar, Button, ErrorBox, Field } from "../components/ui";
import { seedPeople } from "../data";
import { errorText } from "../lib/utils";
import type { Role } from "../types";
import type { Board } from "../useBoard";

export type AuthPage = "signin" | "signup" | "verify";
const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || "";

export function Auth({
  board,
  page,
  navigate,
  onSuccess,
  onBack,
}: {
  board: Board;
  page: AuthPage;
  navigate: (page: AuthPage) => void;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"submit" | "resend" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const signUp = page === "signup";
  const verify = page === "verify";

  function changePage(next: AuthPage) {
    setError("");
    setNotice("");
    setPassword("");
    setCode("");
    navigate(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy("submit");
    setError("");
    setNotice("");
    const address = email.trim().toLowerCase();
    try {
      if (signUp) {
        if (role === "student" && !address.endsWith("@usc.edu")) {
          setError("Enter your @usc.edu email to register as a student.");
          return;
        }
        const result = await board.register({
          full_name: name.trim(),
          email: address,
          password,
          role,
        });
        setEmail(result.email);
        changePage("verify");
        if (result.dev_code) setCode(result.dev_code);
      } else if (verify) {
        await board.verifyEmail(address, code.trim());
        onSuccess();
      } else {
        await board.login(address, password);
        onSuccess();
      }
    } catch (error) {
      if (errorText(error) === "email_not_verified") changePage("verify");
      else setError(errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    if (!email.trim()) {
      setError("Enter your email before requesting a new code.");
      return;
    }
    setBusy("resend");
    setError("");
    setNotice("");
    try {
      const result = await board.resendCode(email.trim().toLowerCase());
      if (result.dev_code) setCode(result.dev_code);
      setNotice(
        "If the account is awaiting verification, a new code has been sent.",
      );
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-card" aria-labelledby="auth-title">
        <button className="text-link auth-back" onClick={onBack}>
          <ArrowLeft size={16} /> Back to job posts
        </button>
        <span className="brand-symbol auth-symbol" aria-hidden="true">
          T
        </span>
        <h1 id="auth-title">
          {verify
            ? "Verify your email"
            : signUp
              ? "Create your account"
              : "Sign in to TrojanLink"}
        </h1>
        {verify && (
          <p className="auth-help">
            Enter the six-digit code sent to your email.
          </p>
        )}
        <form onSubmit={submit}>
          {signUp && (
            <>
              <fieldset className="role-options">
                <legend>I’m a</legend>
                <label>
                  <input
                    type="radio"
                    name="role"
                    checked={role === "student"}
                    onChange={() => setRole("student")}
                  />{" "}
                  Student
                </label>
                <label>
                  <input
                    type="radio"
                    name="role"
                    checked={role === "alumni"}
                    onChange={() => setRole("alumni")}
                  />{" "}
                  Alum
                </label>
              </fieldset>
              <Field label="Full name">
                <input
                  autoComplete="name"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
            </>
          )}
          <Field
            label="Email"
            hint={
              signUp && role === "student"
                ? "Use your @usc.edu address."
                : undefined
            }
          >
            <input
              autoComplete="email"
              type="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (verify) setCode("");
              }}
            />
          </Field>
          {verify ? (
            <Field label="Verification code">
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
              />
            </Field>
          ) : (
            <Field
              label="Password"
              hint={signUp ? "Use at least 8 characters." : undefined}
            >
              <span className="password-input">
                <input
                  autoComplete={signUp ? "new-password" : "current-password"}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={signUp ? 8 : undefined}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </Field>
          )}
          {error && <ErrorBox message={error} />}
          {notice && (
            <p className="auth-help" role="status">
              {notice}
            </p>
          )}
          <Button
            className="auth-submit"
            busy={busy === "submit"}
            disabled={busy === "resend"}
            type="submit"
          >
            {verify
              ? "Verify and sign in"
              : signUp
                ? "Create account"
                : "Sign in"}{" "}
            <ArrowRight size={17} />
          </Button>
        </form>
        <div className="auth-links">
          {verify && (
            <button
              type="button"
              className="text-link"
              onClick={() => void resend()}
              disabled={busy !== null}
            >
              Resend code
            </button>
          )}
          {page !== "signin" ? (
            <button className="text-link" onClick={() => changePage("signin")}>
              Back to sign in
            </button>
          ) : (
            <>
              <button
                className="text-link"
                onClick={() => changePage("signup")}
              >
                Create an account
              </button>
              <button
                className="text-link"
                onClick={() => changePage("verify")}
              >
                Verify email
              </button>
            </>
          )}
        </div>
        {page === "signin" && (
          <div className="sample-accounts">
            <span className="sample-divider">
              {board.settings.mode === "api" && demoPassword
                ? "Demo accounts"
                : "Sample accounts"}
            </span>
            {seedPeople
              .filter((p) => ["alex", "maya", "jordan"].includes(p.id))
              .map((p) => (
                <button
                  key={p.id}
                  className="sample-account"
                  disabled={busy !== null}
                  onClick={async () => {
                    // Connected demo deployments sign in to the seeded backend
                    // accounts; otherwise use the in-browser sample data.
                    if (board.settings.mode === "api" && demoPassword) {
                      setBusy("submit");
                      setError("");
                      try {
                        await board.login(p.email, demoPassword);
                        onSuccess();
                      } catch (e) {
                        setError(errorText(e));
                      } finally {
                        setBusy(null);
                      }
                      return;
                    }
                    board.signInSample(p.id);
                    onSuccess();
                  }}
                >
                  <Avatar person={p} size="sm" />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.role === "student"
                        ? `Student · ${p.program}`
                        : `Alum · ${p.title}, ${p.company}`}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
