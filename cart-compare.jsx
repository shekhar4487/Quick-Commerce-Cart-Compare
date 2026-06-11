import { useState } from "react";

const BANKS = [
  { id: "hdfc", name: "HDFC Bank", cards: ["Credit Card", "Debit Card", "Millennia", "Regalia", "Diners Club"] },
  { id: "sbi", name: "SBI", cards: ["Credit Card", "Debit Card", "SimplyCLICK", "Elite", "BPCL"] },
  { id: "icici", name: "ICICI Bank", cards: ["Credit Card", "Debit Card", "Amazon Pay", "Coral", "Sapphiro"] },
  { id: "axis", name: "Axis Bank", cards: ["Credit Card", "Debit Card", "Flipkart", "ACE", "Magnus"] },
  { id: "kotak", name: "Kotak Bank", cards: ["Credit Card", "Debit Card", "811", "League", "White"] },
  { id: "idfc", name: "IDFC First", cards: ["Credit Card", "Debit Card", "Wealth", "Select"] },
  { id: "amex", name: "Amex", cards: ["Gold", "Platinum", "Membership Rewards", "SmartEarn"] },
  { id: "rbl", name: "RBL Bank", cards: ["Credit Card", "Debit Card", "Shoprite", "Popcorn"] },
];

const APPS = ["Zepto", "Swiggy Instamart", "BigBasket", "Flipkart Minutes"];

// Mock offer data — in real version this gets scraped
const MOCK_OFFERS = {
  Zepto: [
    { id: "z1", bank: "axis", cardKeyword: null, desc: "10% off up to ₹100 on all Axis cards", discount: 0.10, maxDiscount: 100, minOrder: 299, type: "percent" },
    { id: "z2", bank: "hdfc", cardKeyword: null, desc: "5% cashback on HDFC Debit/Credit cards", discount: 0.05, maxDiscount: 75, minOrder: 199, type: "percent" },
    { id: "z3", bank: null, cardKeyword: null, desc: "Flat ₹50 off on orders above ₹399", discount: 50, maxDiscount: 50, minOrder: 399, type: "flat", appOnly: true },
  ],
  "Swiggy Instamart": [
    { id: "s1", bank: "hdfc", cardKeyword: null, desc: "15% off up to ₹150 on HDFC cards", discount: 0.15, maxDiscount: 150, minOrder: 299, type: "percent" },
    { id: "s2", bank: "kotak", cardKeyword: null, desc: "10% off up to ₹100 on Kotak cards", discount: 0.10, maxDiscount: 100, minOrder: 249, type: "percent" },
    { id: "s3", bank: null, cardKeyword: null, desc: "Flat ₹75 off on first order above ₹499", discount: 75, maxDiscount: 75, minOrder: 499, type: "flat", appOnly: true },
  ],
  BigBasket: [
    { id: "b1", bank: "icici", cardKeyword: null, desc: "10% instant discount on ICICI cards", discount: 0.10, maxDiscount: 200, minOrder: 999, type: "percent" },
    { id: "b2", bank: "hdfc", cardKeyword: null, desc: "5% off on HDFC Millennia/Regalia", discount: 0.05, maxDiscount: 100, minOrder: 599, type: "percent" },
    { id: "b3", bank: null, cardKeyword: null, desc: "₹100 off on orders above ₹1200", discount: 100, maxDiscount: 100, minOrder: 1200, type: "flat", appOnly: true },
  ],
  "Flipkart Minutes": [
    { id: "f1", bank: "axis", cardKeyword: "Flipkart", desc: "5% unlimited cashback on Axis Flipkart card", discount: 0.05, maxDiscount: 500, minOrder: 0, type: "percent" },
    { id: "f2", bank: "sbi", cardKeyword: null, desc: "10% off up to ₹150 on SBI Credit cards", discount: 0.10, maxDiscount: 150, minOrder: 399, type: "percent" },
    { id: "f3", bank: null, cardKeyword: null, desc: "Flat ₹60 off on orders above ₹449", discount: 60, maxDiscount: 60, minOrder: 449, type: "flat", appOnly: true },
  ],
};

// Mock product prices
const MOCK_PRICES = {
  Zepto: { basePrice: 1, deliveryFee: 25 },
  "Swiggy Instamart": { basePrice: 1.03, deliveryFee: 30 },
  BigBasket: { basePrice: 0.97, deliveryFee: 0 },
  "Flipkart Minutes": { basePrice: 1.02, deliveryFee: 20 },
};

function getBestOffer(app, cartValue, userCards) {
  const offers = MOCK_OFFERS[app] || [];
  let bestSaving = 0;
  let bestOffer = null;

  for (const offer of offers) {
    if (cartValue < offer.minOrder) continue;

    // Check eligibility
    if (offer.bank) {
      const hasBank = userCards.some(c => c.bankId === offer.bank);
      if (!hasBank) continue;
      if (offer.cardKeyword) {
        const hasCard = userCards.some(c => c.bankId === offer.bank && c.cardName.includes(offer.cardKeyword));
        if (!hasCard) continue;
      }
    }

    let saving = 0;
    if (offer.type === "percent") {
      saving = Math.min(cartValue * offer.discount, offer.maxDiscount);
    } else {
      saving = offer.discount;
    }

    if (saving > bestSaving) {
      bestSaving = saving;
      bestOffer = offer;
    }
  }

  return { saving: bestSaving, offer: bestOffer };
}

export default function CartCompare() {
  const [step, setStep] = useState(1); // 1=cards, 2=grocery, 3=results
  const [selectedBank, setSelectedBank] = useState(null);
  const [userCards, setUserCards] = useState([]); // [{bankId, bankName, cardName}]
  const [groceryInput, setGroceryInput] = useState("");
  const [mockCartValue] = useState(850); // simulated cart total per app
  const [results, setResults] = useState(null);

  const addCard = (bankId, bankName, cardName) => {
    const exists = userCards.find(c => c.bankId === bankId && c.cardName === cardName);
    if (!exists) {
      setUserCards(prev => [...prev, { bankId, bankName, cardName }]);
    }
    setSelectedBank(null);
  };

  const removeCard = (bankId, cardName) => {
    setUserCards(prev => prev.filter(c => !(c.bankId === bankId && c.cardName === cardName)));
  };

  const runComparison = () => {
    const res = APPS.map(app => {
      const { basePrice, deliveryFee } = MOCK_PRICES[app];
      const cartBeforeDiscount = Math.round(mockCartValue * basePrice);
      const { saving, offer } = getBestOffer(app, cartBeforeDiscount, userCards);
      const effectiveTotal = cartBeforeDiscount + deliveryFee - saving;
      return { app, cartBeforeDiscount, deliveryFee, saving, offer, effectiveTotal };
    }).sort((a, b) => a.effectiveTotal - b.effectiveTotal);
    setResults(res);
    setStep(3);
  };

  const appColors = {
    Zepto: "#8B5CF6",
    "Swiggy Instamart": "#FC8019",
    BigBasket: "#84CC16",
    "Flipkart Minutes": "#3B82F6",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0A",
      color: "#F0F0F0",
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0F1A12 0%, #0A0A0A 100%)",
        borderBottom: "1px solid #1A2E1D",
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <div style={{
          width: 36, height: 36,
          background: "#00D26A",
          borderRadius: "10px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "18px",
        }}>🛒</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "17px", letterSpacing: "-0.3px" }}>CartCompare</div>
          <div style={{ fontSize: "12px", color: "#5A7A5E" }}>Quick commerce ka sabse sasta option</div>
        </div>
        {/* Step indicator */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              width: s === step ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: s === step ? "#00D26A" : s < step ? "#00D26A66" : "#1E1E1E",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 20px" }}>

        {/* STEP 1: Card Setup */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "6px" }}>
                Aapke paas kaunse cards hain? 💳
              </div>
              <div style={{ color: "#6B6B6B", fontSize: "14px", lineHeight: 1.5 }}>
                Bank aur app offers calculate karne ke liye yeh zaroori hai. Sirf aapke eligible offers dikhayenge.
              </div>
            </div>

            {/* Added cards */}
            {userCards.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", color: "#00D26A", fontWeight: 600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Added Cards ({userCards.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {userCards.map(c => (
                    <div key={`${c.bankId}-${c.cardName}`} style={{
                      background: "#141414",
                      border: "1px solid #2A2A2A",
                      borderRadius: "20px",
                      padding: "6px 12px",
                      fontSize: "13px",
                      display: "flex", alignItems: "center", gap: "8px",
                    }}>
                      <span style={{ color: "#B0B0B0" }}>{c.bankName} {c.cardName}</span>
                      <span
                        onClick={() => removeCard(c.bankId, c.cardName)}
                        style={{ color: "#FF4444", cursor: "pointer", fontSize: "15px", lineHeight: 1 }}
                      >×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bank selector */}
            {!selectedBank ? (
              <div>
                <div style={{ fontSize: "13px", color: "#6B6B6B", marginBottom: "12px" }}>Select your bank:</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {BANKS.map(bank => (
                    <div
                      key={bank.id}
                      onClick={() => setSelectedBank(bank)}
                      style={{
                        background: "#111111",
                        border: "1px solid #1E1E1E",
                        borderRadius: "12px",
                        padding: "14px 16px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#00D26A55"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "#1E1E1E"}
                    >
                      <span style={{ fontSize: "14px", fontWeight: 500 }}>{bank.name}</span>
                      <span style={{ color: "#3A3A3A", fontSize: "16px" }}>›</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <span
                    onClick={() => setSelectedBank(null)}
                    style={{ color: "#00D26A", cursor: "pointer", fontSize: "14px" }}
                  >← Back</span>
                  <span style={{ color: "#6B6B6B", fontSize: "14px" }}>{selectedBank.name} — Select card type</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedBank.cards.map(card => {
                    const already = userCards.find(c => c.bankId === selectedBank.id && c.cardName === card);
                    return (
                      <div
                        key={card}
                        onClick={() => !already && addCard(selectedBank.id, selectedBank.name, card)}
                        style={{
                          background: already ? "#0D1F10" : "#111111",
                          border: `1px solid ${already ? "#00D26A44" : "#1E1E1E"}`,
                          borderRadius: "10px",
                          padding: "14px 16px",
                          cursor: already ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={e => { if (!already) e.currentTarget.style.borderColor = "#00D26A55" }}
                        onMouseLeave={e => { if (!already) e.currentTarget.style.borderColor = "#1E1E1E" }}
                      >
                        <span style={{ fontSize: "14px" }}>{selectedBank.name} {card}</span>
                        {already
                          ? <span style={{ color: "#00D26A", fontSize: "13px" }}>✓ Added</span>
                          : <span style={{ color: "#3A3A3A" }}>+</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              style={{
                width: "100%",
                marginTop: "28px",
                padding: "16px",
                background: userCards.length > 0 ? "#00D26A" : "#1A1A1A",
                color: userCards.length > 0 ? "#000" : "#3A3A3A",
                border: "none",
                borderRadius: "14px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: userCards.length > 0 ? "pointer" : "default",
                transition: "all 0.2s ease",
                letterSpacing: "-0.2px",
              }}
            >
              {userCards.length === 0 ? "Add at least one card to continue" : `Continue with ${userCards.length} card${userCards.length > 1 ? "s" : ""} →`}
            </button>

            {userCards.length === 0 && (
              <div
                onClick={() => setStep(2)}
                style={{ textAlign: "center", marginTop: "12px", color: "#3A3A3A", fontSize: "13px", cursor: "pointer" }}
              >
                Skip for now (only app offers will show)
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Grocery List */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "6px" }}>
                Kya kya lena hai? 🥦
              </div>
              <div style={{ color: "#6B6B6B", fontSize: "14px", lineHeight: 1.5 }}>
                Ek item per line likho. Quantity bhi likh sakte ho.
              </div>
            </div>

            <textarea
              value={groceryInput}
              onChange={e => setGroceryInput(e.target.value)}
              placeholder={"Amul Butter 500g\nTata Salt 1kg\nAashirvaad Atta 5kg\nMilk 1L x2\nOnion 1kg"}
              style={{
                width: "100%",
                minHeight: "200px",
                background: "#111111",
                border: "1px solid #1E1E1E",
                borderRadius: "14px",
                padding: "16px",
                color: "#F0F0F0",
                fontSize: "15px",
                lineHeight: 1.7,
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
              onFocus={e => e.target.style.borderColor = "#00D26A44"}
              onBlur={e => e.target.style.borderColor = "#1E1E1E"}
            />

            {/* Cart value note */}
            <div style={{
              background: "#0D1A1F",
              border: "1px solid #1A3040",
              borderRadius: "10px",
              padding: "12px 14px",
              marginTop: "14px",
              fontSize: "13px",
              color: "#5A8A9F",
              lineHeight: 1.5,
            }}>
              ℹ️ Demo mode: Cart value ₹{mockCartValue} assumed across all apps. Real version mein live prices scrape honge.
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "transparent",
                  color: "#6B6B6B",
                  border: "1px solid #2A2A2A",
                  borderRadius: "14px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >← Back</button>
              <button
                onClick={runComparison}
                disabled={!groceryInput.trim()}
                style={{
                  flex: 3,
                  padding: "14px",
                  background: groceryInput.trim() ? "#00D26A" : "#1A1A1A",
                  color: groceryInput.trim() ? "#000" : "#3A3A3A",
                  border: "none",
                  borderRadius: "14px",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: groceryInput.trim() ? "pointer" : "default",
                  transition: "all 0.2s ease",
                }}
              >
                Compare Prices →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Results */}
        {step === 3 && results && (
          <div>
            {/* Winner banner */}
            <div style={{
              background: "linear-gradient(135deg, #00D26A15, #00D26A08)",
              border: "1px solid #00D26A33",
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "20px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "12px", color: "#00D26A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                🏆 Best Deal
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: "4px" }}>
                {results[0].app}
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#00D26A" }}>
                ₹{results[0].effectiveTotal}
              </div>
              {results[0].saving > 0 && (
                <div style={{ fontSize: "13px", color: "#5A7A5E", marginTop: "4px" }}>
                  Saving ₹{Math.round(results[0].saving)} vs no-offer price
                </div>
              )}
              {results[0].saving > 0 && results[results.length - 1].effectiveTotal - results[0].effectiveTotal > 0 && (
                <div style={{
                  display: "inline-block",
                  background: "#00D26A22",
                  border: "1px solid #00D26A44",
                  borderRadius: "20px",
                  padding: "4px 12px",
                  fontSize: "13px",
                  color: "#00D26A",
                  marginTop: "8px",
                }}>
                  ₹{results[results.length - 1].effectiveTotal - results[0].effectiveTotal} cheaper than most expensive option
                </div>
              )}
            </div>

            {/* All results */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {results.map((r, i) => (
                <div key={r.app} style={{
                  background: i === 0 ? "#0D1A10" : "#0F0F0F",
                  border: `1px solid ${i === 0 ? "#00D26A33" : "#1E1E1E"}`,
                  borderRadius: "14px",
                  padding: "16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: 8, height: 8,
                        borderRadius: "50%",
                        background: appColors[r.app] || "#888",
                      }} />
                      <span style={{ fontWeight: 600, fontSize: "15px" }}>{r.app}</span>
                      {i === 0 && <span style={{ fontSize: "11px", background: "#00D26A22", color: "#00D26A", padding: "2px 8px", borderRadius: "10px" }}>Best</span>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: "18px" }}>₹{r.effectiveTotal}</div>
                      {i > 0 && <div style={{ fontSize: "12px", color: "#FF6B6B" }}>+₹{r.effectiveTotal - results[0].effectiveTotal} more</div>}
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div style={{ fontSize: "12px", color: "#4A4A4A", display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Cart value</span>
                      <span style={{ color: "#6B6B6B" }}>₹{r.cartBeforeDiscount}</span>
                    </div>
                    {r.deliveryFee > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Delivery</span>
                        <span style={{ color: "#6B6B6B" }}>+₹{r.deliveryFee}</span>
                      </div>
                    )}
                    {r.deliveryFee === 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Delivery</span>
                        <span style={{ color: "#00D26A" }}>Free</span>
                      </div>
                    )}
                    {r.saving > 0 && r.offer && (
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        marginTop: "6px",
                        paddingTop: "6px",
                        borderTop: "1px solid #1A1A1A",
                      }}>
                        <span style={{ color: "#00A854" }}>🏷️ {r.offer.desc}</span>
                        <span style={{ color: "#00A854" }}>-₹{Math.round(r.saving)}</span>
                      </div>
                    )}
                    {r.saving === 0 && (
                      <div style={{ color: "#3A3A3A", marginTop: "4px", fontStyle: "italic" }}>
                        No eligible offers for your cards
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Items ordered */}
            {groceryInput.trim() && (
              <div style={{
                background: "#0F0F0F",
                border: "1px solid #1A1A1A",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "20px",
              }}>
                <div style={{ fontSize: "12px", color: "#4A4A4A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>
                  Your List
                </div>
                {groceryInput.trim().split("\n").filter(Boolean).map((item, i) => (
                  <div key={i} style={{ fontSize: "14px", color: "#8A8A8A", padding: "4px 0", borderBottom: i < groceryInput.trim().split("\n").filter(Boolean).length - 1 ? "1px solid #141414" : "none" }}>
                    {item}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setStep(2); setResults(null); }}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "transparent",
                  color: "#6B6B6B",
                  border: "1px solid #2A2A2A",
                  borderRadius: "14px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >Edit List</button>
              <button
                onClick={() => {
                  const best = results[0];
                  alert(`Opening ${best.app}...\n\nIn real version, yeh automatically cart mein items add kar dega.\nAap sirf checkout karo aur pay karo! 🚀`);
                }}
                style={{
                  flex: 3,
                  padding: "14px",
                  background: "#00D26A",
                  color: "#000",
                  border: "none",
                  borderRadius: "14px",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Open {results[0].app} & Add to Cart →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
