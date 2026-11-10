
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function BusinessSetupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    business_name: "",
    business_type: "",
    phone: "",
    email: "",
    county: "",
    town: "",
    address: ""
  });

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.business_name.trim() || !form.business_type.trim()) {
      setError("Please enter your business name and business type.");
      return;
    }

    setLoading(true);

    try {
      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError || !user) {
        setError("Your session has expired. Please log in again.");
        setLoading(false);
        return;
      }

      const { error: saveError } = await supabase
        .from("businesses")
        .insert({
          owner_id: user.id,
          business_name: form.business_name.trim(),
          business_type: form.business_type.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          county: form.county.trim() || null,
          town: form.town.trim() || null,
          address: form.address.trim() || null,
          currency: "KES"
        });

      if (saveError) {
        throw saveError;
      }

      setSuccess("Your business has been saved successfully!");

      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1200);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "13px",
    border: "1px solid #d1d5db",
    borderRadius: "9px",
    fontSize: "15px",
    marginTop: "7px",
    boxSizing: "border-box" as const,
    background: "#ffffff",
    color: "#17251c"
  };

  const labelStyle = {
    display: "block",
    fontWeight: 600,
    fontSize: "14px",
    color: "#263b2e",
    marginBottom: "17px"
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f3f7f3",
      padding: "35px 16px",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        maxWidth: "650px",
        margin: "0 auto",
        background: "#ffffff",
        borderRadius: "16px",
        padding: "30px",
        boxShadow: "0 5px 25px rgba(0,0,0,0.06)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1 style={{
            color: "#164a32",
            fontSize: "30px",
            margin: "0 0 8px"
          }}>
            MALIKEEP
          </h1>

          <h2 style={{
            fontSize: "22px",
            color: "#24382b",
            margin: "0 0 10px"
          }}>
            Set Up Your Business
          </h2>

          <p style={{ color: "#68756c", fontSize: "14px" }}>
            Tell us about your business to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            Business Name *
            <input
              style={inputStyle}
              value={form.business_name}
              onChange={(e) => updateField("business_name", e.target.value)}
              placeholder="e.g. Ongara General Stores"
              required
            />
          </label>

          <label style={labelStyle}>
            Business Type *
            <select
              style={inputStyle}
              value={form.business_type}
              onChange={(e) => updateField("business_type", e.target.value)}
              required
            >
              <option value="">Select business type</option>
              <option value="Retail Shop">Retail Shop</option>
              <option value="Wholesale">Wholesale</option>
              <option value="Bar and Restaurant">Bar and Restaurant</option>
              <option value="Salon and Beauty">Salon and Beauty</option>
              <option value="Cyber Cafe">Cyber Cafe</option>
              <option value="Hardware">Hardware</option>
              <option value="Clothing and Fashion">Clothing and Fashion</option>
              <option value="Agriculture">Agriculture</option>
              <option value="Services">Services</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label style={labelStyle}>
            Phone Number
            <input
              style={inputStyle}
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="e.g. 07XXXXXXXX"
              type="tel"
            />
          </label>

          <label style={labelStyle}>
            Business Email
            <input
              style={inputStyle}
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="business@example.com"
              type="email"
            />
          </label>

          <label style={labelStyle}>
            County
            <input
              style={inputStyle}
              value={form.county}
              onChange={(e) => updateField("county", e.target.value)}
              placeholder="e.g. Homa Bay"
            />
          </label>

          <label style={labelStyle}>
            Town
            <input
              style={inputStyle}
              value={form.town}
              onChange={(e) => updateField("town", e.target.value)}
              placeholder="Enter your town"
            />
          </label>

          <label style={labelStyle}>
            Physical Address
            <textarea
              style={{ ...inputStyle, minHeight: "85px" }}
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Enter your business location"
            />
          </label>

          <div style={{
            background: "#e8f1ea",
            padding: "13px",
            borderRadius: "9px",
            marginBottom: "20px",
            color: "#164a32",
            fontSize: "14px"
          }}>
            Default currency: <strong>Kenyan Shilling (KES)</strong>
          </div>

          {error && (
            <p style={{ color: "#b42318", fontSize: "14px" }}>
              {error}
            </p>
          )}

          {success && (
            <p style={{ color: "#167044", fontSize: "14px" }}>
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "15px",
              background: loading ? "#789080" : "#164a32",
              color: "#ffffff",
              border: "none",
              borderRadius: "9px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Saving Business..." : "Save Business Details"}
          </button>
        </form>
      </div>
    </main>
  );
}
