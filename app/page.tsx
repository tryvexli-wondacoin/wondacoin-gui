"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Server,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Lock,
  Users,
  CreditCard,
  Receipt,
  Coins,
  ScrollText,
  UserPlus,
  ArrowRightLeft,
  Search,
  Download,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  UserCircle2,
} from "lucide-react";

const API_BASE = "https://wondacoin-backend.onrender.com/";
const TOKEN_KEY = "wondacoin_admin_token";
const AUTO_REFRESH_MS = 10000;

type AnyObj = Record<string, any>;

function downloadCsv(filename: string, rows: AnyObj[], columns: string[]) {
  const escapeCsv = (value: any) => {
    const str = String(value ?? "");
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((col) => escapeCsv(row[col])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function isWithinDateRange(value: string, start: string, end: string) {
  if (!start && !end) return true;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;

  if (start) {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    if (d < s) return false;
  }

  if (end) {
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    if (d > e) return false;
  }

  return true;
}

export default function Page() {
  const [token, setToken] = useState<string>("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [balanceResult, setBalanceResult] = useState<any>(null);
  const [lastAction, setLastAction] = useState<any>(null);

  const [createUser, setCreateUser] = useState({ name: "", email: "" });
  const [fundWallet, setFundWallet] = useState({
    user_id: "",
    amount: "",
    description: "",
  });
  const [transfer, setTransfer] = useState({
    from_user_id: "",
    to_user_id: "",
    amount: "",
    description: "",
  });
  const [balanceLookup, setBalanceLookup] = useState({ user_id: "" });

  const [auditSearch, setAuditSearch] = useState("");
  const [auditStartDate, setAuditStartDate] = useState("");
  const [auditEndDate, setAuditEndDate] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditUserFilter, setAuditUserFilter] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
    }, AUTO_REFRESH_MS);

    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    setAuditPage(1);
  }, [
    auditSearch,
    auditStartDate,
    auditEndDate,
    auditActionFilter,
    auditUserFilter,
    auditPageSize,
  ]);

  async function apiFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
        ...(options.headers || {}),
      },
    });

    return res.json();
  }

  async function login() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch(`${API_BASE}/admin-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setMessage("Login successful");
      } else {
        setMessage(data.message || "Login failed");
      }
    } catch (err: any) {
      setMessage(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard() {
    try {
      setLoading(true);
      const [statsData, auditData] = await Promise.all([
        apiFetch("/stats"),
        apiFetch("/audit-logs"),
      ]);

      if (statsData.success) {
        setStats(statsData.stats);
      }

      if (auditData.success) {
        setAuditLogs(auditData.audit_logs || []);
      }
    } catch (err: any) {
      setMessage(err?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(path: string) {
    try {
      setLoading(true);
      const data = await apiFetch(path);
      setLastAction(data);
      setMessage(data.message || "Action completed");

      if (data.success) {
        await loadDashboard();
      }
    } catch (err: any) {
      setMessage(err?.message || "Action failed");
    } finally {
      setLoading(false);
    }
  }

  async function runBalanceLookup() {
    try {
      setLoading(true);
      const data = await apiFetch(`/wallet-balance?user_id=${balanceLookup.user_id}`);
      setBalanceResult(data);
      setLastAction(data);
      setMessage(data.message || "Balance lookup complete");

      if (data.success) {
        await loadDashboard();
      }
    } catch (err: any) {
      setMessage(err?.message || "Balance lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setStats(null);
    setAuditLogs([]);
    setBalanceResult(null);
    setLastAction(null);
    setMessage("Logged out");
  }

  const auditActionOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        auditLogs
          .map((row) => String(row.action ?? "").trim())
          .filter(Boolean)
      )
    ).sort();

    return unique;
  }, [auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    const uf = auditUserFilter.trim().toLowerCase();

    return auditLogs.filter((row) => {
      const matchesSearch =
        !q ||
        [
          row.id,
          row.admin_user,
          row.action,
          row.target_type,
          row.target_id,
          row.details,
          row.created_at,
        ]
          .map((v) => String(v ?? "").toLowerCase())
          .some((v) => v.includes(q));

      const matchesDate = isWithinDateRange(
        String(row.created_at ?? ""),
        auditStartDate,
        auditEndDate
      );

      const matchesAction =
        auditActionFilter === "all" ||
        String(row.action ?? "") === auditActionFilter;

      const userHaystack = [
        row.target_id,
        row.details,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");

      const matchesUser =
        !uf ||
        userHaystack.includes(uf) ||
        userHaystack.includes(`user ${uf}`) ||
        userHaystack.includes(`user ${uf} `) ||
        userHaystack.includes(`${uf}->`) ||
        userHaystack.includes(`->${uf}`);

      return matchesSearch && matchesDate && matchesAction && matchesUser;
    });
  }, [
    auditLogs,
    auditSearch,
    auditStartDate,
    auditEndDate,
    auditActionFilter,
    auditUserFilter,
  ]);

  const totalAuditPages = Math.max(1, Math.ceil(filteredAuditLogs.length / auditPageSize));

  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * auditPageSize;
    const end = start + auditPageSize;
    return filteredAuditLogs.slice(start, end);
  }, [filteredAuditLogs, auditPage, auditPageSize]);

  const safeAuditPage = Math.min(auditPage, totalAuditPages);

  useEffect(() => {
    if (auditPage > totalAuditPages) {
      setAuditPage(totalAuditPages);
    }
  }, [auditPage, totalAuditPages]);

  if (!token) {
    return (
      <div style={pageStyle}>
        <div style={loginCardStyle}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
            <div style={iconWrapStyle}>
              <Lock size={26} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 28 }}>Protected Admin Login</h1>
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                Sign in to access the Wondacoin dashboard
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <input
              style={inputStyle}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />

            <button style={buttonStyle} onClick={login} disabled={loading}>
              Log In
            </button>

            {message && (
              <div style={noticeStyle}>
                <AlertTriangle size={16} />
                <span>{message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={iconWrapStyle}>
                <Wallet size={26} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 28 }}>Wondacoin Protected Admin</h1>
                <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                  Protected dashboard with searchable audit logging
                </p>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "grid", gap: 10 }}>
              <button style={buttonStyle} onClick={loadDashboard} disabled={loading}>
                <Server size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Refresh Dashboard
              </button>

              <button
                style={{ ...buttonStyle, background: "#7f1d1d" }}
                onClick={logout}
              >
                <LogOut size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Log Out
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div style={cardStyle}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#065f46" }}>
              <CheckCircle2 size={18} />
              <span>{message}</span>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <StatCard icon={<Users size={18} />} title="Total Users" value={stats?.total_users ?? "-"} />
          <StatCard icon={<CreditCard size={18} />} title="Total Wallets" value={stats?.total_wallets ?? "-"} />
          <StatCard icon={<Receipt size={18} />} title="Transactions" value={stats?.total_transactions ?? "-"} />
          <StatCard icon={<Coins size={18} />} title="Total Balance" value={stats?.total_balance ?? "-"} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Admin Actions</h2>

            <div style={{ display: "grid", gap: 18 }}>
              <section style={sectionStyle}>
                <h3 style={sectionTitle}>
                  <UserPlus size={18} /> Create User
                </h3>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <input
                    placeholder="Kojo"
                    value={createUser.name}
                    onChange={(e) => setCreateUser((s) => ({ ...s, name: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder="kojo@mail.com"
                    value={createUser.email}
                    onChange={(e) => setCreateUser((s) => ({ ...s, email: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <button
                  style={buttonStyle}
                  disabled={loading}
                  onClick={() =>
                    runAction(
                      `/create-user?name=${encodeURIComponent(createUser.name)}&email=${encodeURIComponent(createUser.email)}`
                    )
                  }
                >
                  Create User
                </button>
              </section>

              <section style={sectionStyle}>
                <h3 style={sectionTitle}>
                  <Coins size={18} /> Fund Wallet
                </h3>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <input
                    placeholder="User ID"
                    value={fundWallet.user_id}
                    onChange={(e) => setFundWallet((s) => ({ ...s, user_id: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder="Amount"
                    value={fundWallet.amount}
                    onChange={(e) => setFundWallet((s) => ({ ...s, amount: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder="Description"
                    value={fundWallet.description}
                    onChange={(e) => setFundWallet((s) => ({ ...s, description: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <button
                  style={buttonStyle}
                  disabled={loading}
                  onClick={() =>
                    runAction(
                      `/fund-wallet?user_id=${encodeURIComponent(fundWallet.user_id)}&amount=${encodeURIComponent(fundWallet.amount)}&description=${encodeURIComponent(fundWallet.description)}`
                    )
                  }
                >
                  Fund Wallet
                </button>
              </section>

              <section style={sectionStyle}>
                <h3 style={sectionTitle}>
                  <ArrowRightLeft size={18} /> Transfer
                </h3>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                  <input
                    placeholder="From User ID"
                    value={transfer.from_user_id}
                    onChange={(e) => setTransfer((s) => ({ ...s, from_user_id: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder="To User ID"
                    value={transfer.to_user_id}
                    onChange={(e) => setTransfer((s) => ({ ...s, to_user_id: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder="Amount"
                    value={transfer.amount}
                    onChange={(e) => setTransfer((s) => ({ ...s, amount: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder="Description"
                    value={transfer.description}
                    onChange={(e) => setTransfer((s) => ({ ...s, description: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <button
                  style={buttonStyle}
                  disabled={loading}
                  onClick={() =>
                    runAction(
                      `/transfer?from_user_id=${encodeURIComponent(transfer.from_user_id)}&to_user_id=${encodeURIComponent(transfer.to_user_id)}&amount=${encodeURIComponent(transfer.amount)}&description=${encodeURIComponent(transfer.description)}`
                    )
                  }
                >
                  Transfer Funds
                </button>
              </section>

              <section style={sectionStyle}>
                <h3 style={sectionTitle}>
                  <Search size={18} /> Wallet Balance Lookup
                </h3>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr auto" }}>
                  <input
                    placeholder="User ID"
                    value={balanceLookup.user_id}
                    onChange={(e) => setBalanceLookup({ user_id: e.target.value })}
                    style={inputStyle}
                  />
                  <button style={{ ...buttonStyle, marginTop: 0, width: 220 }} onClick={runBalanceLookup}>
                    Get Balance
                  </button>
                </div>
              </section>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Last Action</h2>
            <ResponseBox data={lastAction} empty="No action run yet." />
            <div style={{ marginTop: 18 }}>
              <h2 style={{ marginTop: 0 }}>Balance Lookup Result</h2>
              <ResponseBox data={balanceResult} empty="No balance lookup yet." />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <ScrollText size={20} />
              <h2 style={{ margin: 0 }}>Audit Log</h2>
            </div>

            <button
              onClick={() =>
                downloadCsv(
                  "wondacoin_audit_logs.csv",
                  filteredAuditLogs,
                  ["id", "admin_user", "action", "target_type", "target_id", "details", "created_at"]
                )
              }
              style={smallButtonStyle}
            >
              <Download size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Export CSV
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 180px 180px 220px 180px",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <div style={filterLabelStyle}>
                <Search size={14} />
                Search logs
              </div>
              <input
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search by action, admin, target, details..."
                style={inputStyle}
              />
            </div>

            <div>
              <div style={filterLabelStyle}>
                <CalendarDays size={14} />
                Start date
              </div>
              <input
                type="date"
                value={auditStartDate}
                onChange={(e) => setAuditStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={filterLabelStyle}>
                <CalendarDays size={14} />
                End date
              </div>
              <input
                type="date"
                value={auditEndDate}
                onChange={(e) => setAuditEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={filterLabelStyle}>
                <Filter size={14} />
                Action type
              </div>
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                style={inputStyle}
              >
                <option value="all">All actions</option>
                {auditActionOptions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={filterLabelStyle}>
                <UserCircle2 size={14} />
                User filter
              </div>
              <input
                value={auditUserFilter}
                onChange={(e) => setAuditUserFilter(e.target.value)}
                placeholder="e.g. 3"
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ color: "#475569", fontSize: 14 }}>
              Showing {paginatedAuditLogs.length} of {filteredAuditLogs.length} audit record(s)
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={filterLabelStyle}>
                <CalendarDays size={14} />
                Rows per page
              </div>
              <select
                value={auditPageSize}
                onChange={(e) => setAuditPageSize(Number(e.target.value))}
                style={{ ...inputStyle, width: 110, padding: 10 }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <AuditTable rows={paginatedAuditLogs} />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ color: "#475569", fontSize: 14 }}>
              Page {safeAuditPage} of {totalAuditPages}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                style={pagerButtonStyle}
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                disabled={safeAuditPage <= 1}
              >
                <ChevronLeft size={16} />
                Prev
              </button>

              {Array.from({ length: totalAuditPages }).slice(0, 7).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setAuditPage(pageNum)}
                    style={{
                      ...pageNumberStyle,
                      background: safeAuditPage === pageNum ? "#111827" : "white",
                      color: safeAuditPage === pageNum ? "white" : "#111827",
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {totalAuditPages > 7 && (
                <span style={{ color: "#64748b", padding: "0 6px" }}>...</span>
              )}

              {totalAuditPages > 7 && (
                <button
                  onClick={() => setAuditPage(totalAuditPages)}
                  style={{
                    ...pageNumberStyle,
                    background: safeAuditPage === totalAuditPages ? "#111827" : "white",
                    color: safeAuditPage === totalAuditPages ? "white" : "#111827",
                  }}
                >
                  {totalAuditPages}
                </button>
              )}

              <button
                style={pagerButtonStyle}
                onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                disabled={safeAuditPage >= totalAuditPages}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditTable({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) {
    return <div style={{ color: "#64748b" }}>No audit logs found.</div>;
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 18 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["id", "admin_user", "action", "target_type", "target_id", "details", "created_at"].map((col) => (
              <th
                key={col}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderBottom: "1px solid #e2e8f0",
                  whiteSpace: "nowrap",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {["id", "admin_user", "action", "target_type", "target_id", "details", "created_at"].map((col) => (
                <td
                  key={col}
                  style={{
                    padding: 12,
                    borderBottom: "1px solid #f1f5f9",
                    verticalAlign: "top",
                    whiteSpace: col === "details" ? "normal" : "nowrap",
                  }}
                >
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResponseBox({ data, empty }: { data: any; empty: string }) {
  return (
    <div
      style={{
        borderRadius: 18,
        background: "#020617",
        color: "#e2e8f0",
        minHeight: 180,
        padding: 18,
        overflow: "auto",
        fontSize: 14,
      }}
    >
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
        {data ? JSON.stringify(data, null, 2) : empty}
      </pre>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ color: "#475569", fontSize: 14 }}>{title}</div>
        <div style={{ color: "#0f172a" }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: 24,
  fontFamily: "Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
};

const loginCardStyle: React.CSSProperties = {
  ...cardStyle,
  maxWidth: 500,
  margin: "60px auto",
};

const iconWrapStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "white",
  borderRadius: 18,
  padding: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  background: "white",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 16,
  border: "none",
  background: "#111827",
  color: "white",
  cursor: "pointer",
  fontSize: 15,
};

const smallButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "#0f172a",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const pagerButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#111827",
  cursor: "pointer",
  fontSize: 14,
};

const pageNumberStyle: React.CSSProperties = {
  minWidth: 40,
  height: 40,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  cursor: "pointer",
  fontSize: 14,
};

const noticeStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  background: "#fff7ed",
  color: "#9a3412",
  padding: 12,
  borderRadius: 14,
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
};

const sectionTitle: React.CSSProperties = {
  marginTop: 0,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const filterLabelStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  marginBottom: 6,
  color: "#475569",
  fontSize: 13,
};