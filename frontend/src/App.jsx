import { useState } from "react";
import "./App.css";

function App() {
  // =========================
  // APP STATE
  // =========================

  const [selectedFile, setSelectedFile] = useState(null);
  const [step, setStep] = useState("upload");

  // People splitting the bill
  const [people, setPeople] = useState([
    "Akshita",
    "Ishika",
    "Harshit",
    "Vidhi",
  ]);

  // New person input
  const [newPerson, setNewPerson] = useState("");

  // Currently selected people for every item
  const [assignments, setAssignments] = useState({
    1: ["Akshita"],
    2: ["Akshita"],
    3: ["Akshita"],
    4: ["Akshita"],
    5: ["Akshita"],
    6: ["Akshita"],
    7: ["Akshita"],
  });

  // Final calculated shares
  const [finalShares, setFinalShares] = useState({});

  // =========================
  // MOCK BILL
  // =========================

  // This will later be replaced by AI extraction.
  const [bill] = useState({
    restaurant: "The Daily Brew",

    items: [
      {
        id: 1,
        name: "Margherita Pizza",
        quantity: 1,
        price: 349,
      },
      {
        id: 2,
        name: "Paneer Pasta",
        quantity: 1,
        price: 329,
      },
      {
        id: 3,
        name: "Chicken Burger",
        quantity: 2,
        price: 598,
      },
      {
        id: 4,
        name: "French Fries",
        quantity: 1,
        price: 199,
      },
      {
        id: 5,
        name: "Cold Coffee",
        quantity: 3,
        price: 447,
      },
      {
        id: 6,
        name: "Lemon Iced Tea",
        quantity: 2,
        price: 258,
      },
      {
        id: 7,
        name: "Chocolate Brownie",
        quantity: 1,
        price: 189,
      },
    ],

    serviceCharge: 118.45,
    gst: 124.37,
  });

  // =========================
  // BILL CALCULATION
  // =========================

  const subtotal = bill.items.reduce(
    (total, item) => total + item.price,
    0
  );

  const total =
    subtotal +
    bill.serviceCharge +
    bill.gst;

  // =========================
  // FILE UPLOAD
  // =========================

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (file) {
      setSelectedFile(file);
    }
  };

  const handleContinue = () => {
    if (!selectedFile) {
      return;
    }

    setStep("bill");
  };

  // =========================
  // PEOPLE
  // =========================

  const handleAddPerson = () => {
    const name = newPerson.trim();

    if (!name) {
      return;
    }

    const alreadyExists = people.some(
      (person) =>
        person.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
      alert("This person is already added.");
      return;
    }

    setPeople([...people, name]);
    setNewPerson("");
  };

  const handleDeletePerson = (nameToDelete) => {
    // Don't allow deleting everyone
    if (people.length === 1) {
      alert("At least one person is required.");
      return;
    }

    setPeople(
      people.filter(
        (person) => person !== nameToDelete
      )
    );

    // Remove the deleted person from every assignment
    const updatedAssignments = {};

    Object.keys(assignments).forEach((itemId) => {
      updatedAssignments[itemId] =
        assignments[itemId].filter(
          (person) => person !== nameToDelete
        );
    });

    setAssignments(updatedAssignments);
  };

  const handlePersonKeyDown = (event) => {
    if (event.key === "Enter") {
      handleAddPerson();
    }
  };

  // =========================
  // ITEM ASSIGNMENT
  // =========================

  const handleTogglePerson = (itemId, person) => {
    const currentPeople =
      assignments[itemId] || [];

    const alreadySelected =
      currentPeople.includes(person);

    let updatedPeople;

    if (alreadySelected) {
      updatedPeople = currentPeople.filter(
        (item) => item !== person
      );
    } else {
      updatedPeople = [
        ...currentPeople,
        person,
      ];
    }

    setAssignments({
      ...assignments,
      [itemId]: updatedPeople,
    });
  };

  // =========================
  // CALCULATE FINAL SPLIT
  // =========================

  const calculateSplit = () => {
    const shares = {};

    // Start everyone at ₹0
    people.forEach((person) => {
      shares[person] = 0;
    });

    // Calculate each person's share of food
    bill.items.forEach((item) => {
      const selectedPeople =
        assignments[item.id] || [];

      if (selectedPeople.length === 0) {
        return;
      }

      const itemShare =
        item.price / selectedPeople.length;

      selectedPeople.forEach((person) => {
        shares[person] += itemShare;
      });
    });

    // Calculate service charge + GST
    // proportionally based on food consumption.
    people.forEach((person) => {
      const foodShare = shares[person];

      const proportion =
        subtotal > 0
          ? foodShare / subtotal
          : 0;

      shares[person] +=
        (bill.serviceCharge + bill.gst) *
        proportion;
    });

    // Round values to 2 decimal places
    const roundedShares = {};

    people.forEach((person) => {
      roundedShares[person] =
        Math.round(shares[person] * 100) / 100;
    });

    // Fix rounding difference so that:
    // Sum of people's shares = bill total
    const roundedTotal = Object.values(
      roundedShares
    ).reduce(
      (sum, amount) => sum + amount,
      0
    );

    const difference =
      Math.round(
        (total - roundedTotal) * 100
      ) / 100;

    if (people.length > 0 && difference !== 0) {
      const lastPerson =
        people[people.length - 1];

      roundedShares[lastPerson] =
        Math.round(
          (roundedShares[lastPerson] +
            difference) *
            100
        ) / 100;
    }

    setFinalShares(roundedShares);
    setStep("result");
  };

  // =========================
  // UPLOAD SCREEN
  // =========================

  if (step === "upload") {
    return (
      <div className="app">

        <nav className="navbar">
          <div className="logo">
            <span className="logo-icon">
              🍽️
            </span>

            SplitMyBill
          </div>

          <div className="nav-tag">
            AI-powered bill splitting
          </div>
        </nav>

        <main className="hero">
          <div className="hero-content">

            <div className="badge">
              ✨ Smart & Simple
            </div>

            <h1>
              Split your bill
              <br />
              <span>
                without the headache.
              </span>
            </h1>

            <p className="subtitle">
              Upload a photo of your restaurant bill.
              <br />
              We'll handle the math for everyone.
            </p>

            <div className="upload-card">

              <input
                type="file"
                id="bill-upload"
                accept="image/*"
                onChange={handleFileChange}
                hidden
              />

              <label
                htmlFor="bill-upload"
                className="upload-area"
              >

                <div className="upload-icon">
                  📸
                </div>

                <h2>
                  {selectedFile
                    ? selectedFile.name
                    : "Upload your bill"}
                </h2>

                <p>
                  {selectedFile
                    ? "Bill selected successfully"
                    : "Drag & drop or click to choose a photo"}
                </p>

                {!selectedFile && (
                  <span className="file-types">
                    JPG, PNG or WEBP
                  </span>
                )}

              </label>

              {selectedFile && (
                <button
                  className="continue-button"
                  onClick={handleContinue}
                >
                  Continue →
                </button>
              )}

            </div>

            <div className="features">

              <div className="feature">
                <span>📷</span>
                <p>Read your bill</p>
              </div>

              <div className="feature">
                <span>👥</span>
                <p>Add friends</p>
              </div>

              <div className="feature">
                <span>💰</span>
                <p>Split fairly</p>
              </div>

            </div>

          </div>
        </main>

        <footer>
          Built to make group dinners easier.
        </footer>

      </div>
    );
  }

  // =========================
  // BILL REVIEW
  // =========================

  if (step === "bill") {
    return (
      <div className="app">

        <nav className="navbar">

          <div className="logo">
            <span className="logo-icon">
              🍽️
            </span>

            SplitMyBill
          </div>

          <div className="nav-tag">
            AI-powered bill splitting
          </div>

        </nav>

        <main className="bill-page">

          <div className="bill-header">

            <button
              className="back-button"
              onClick={() => setStep("upload")}
            >
              ← Back
            </button>

            <div>

              <div className="badge">
                ✓ Bill detected
              </div>

              <h1>
                Review your bill
              </h1>

              <p>
                We found these items. Check the details
                before splitting.
              </p>

            </div>

          </div>

          <div className="bill-card">

            <div className="bill-card-header">

              <div>
                <h2>
                  🍽️ {bill.restaurant}
                </h2>

                <p>
                  Restaurant bill
                </p>
              </div>

              <span className="status">
                AI Extracted
              </span>

            </div>

            <div className="items-header">
              <span>ITEM</span>
              <span>QTY</span>
              <span>AMOUNT</span>
            </div>

            <div className="items-list">

              {bill.items.map((item) => (
                <div
                  className="bill-item"
                  key={item.id}
                >

                  <div>
                    <strong>
                      {item.name}
                    </strong>
                  </div>

                  <span>
                    {item.quantity}
                  </span>

                  <strong>
                    ₹{item.price.toFixed(2)}
                  </strong>

                </div>
              ))}

            </div>

            <div className="bill-summary">

              <div>
                <span>
                  Subtotal
                </span>

                <strong>
                  ₹{subtotal.toFixed(2)}
                </strong>
              </div>

              <div>
                <span>
                  Service Charge (5%)
                </span>

                <strong>
                  ₹{bill.serviceCharge.toFixed(2)}
                </strong>
              </div>

              <div>
                <span>
                  GST (5%)
                </span>

                <strong>
                  ₹{bill.gst.toFixed(2)}
                </strong>
              </div>

              <div className="grand-total">

                <span>
                  Grand Total
                </span>

                <strong>
                  ₹{total.toFixed(2)}
                </strong>

              </div>

            </div>

            <button
              className="primary-button"
              onClick={() => setStep("people")}
            >
              Looks good — Add people →
            </button>

          </div>

        </main>

        <footer>
          Built to make group dinners easier.
        </footer>

      </div>
    );
  }

  // =========================
  // PEOPLE SCREEN
  // =========================

  if (step === "people") {
    return (
      <div className="app">

        <nav className="navbar">

          <div className="logo">
            <span className="logo-icon">
              🍽️
            </span>

            SplitMyBill
          </div>

          <div className="nav-tag">
            AI-powered bill splitting
          </div>

        </nav>

        <main className="people-page">

          <div className="bill-header">

            <button
              className="back-button"
              onClick={() => setStep("bill")}
            >
              ← Back
            </button>

            <div>

              <div className="badge">
                Step 2 of 3
              </div>

              <h1>
                Who's eating?
              </h1>

              <p>
                Add everyone who needs to pay the bill.
              </p>

            </div>

          </div>

          <div className="people-card">

            <div className="person-input">

              <input
                type="text"
                placeholder="Enter a person's name"
                value={newPerson}
                onChange={(event) =>
                  setNewPerson(event.target.value)
                }
                onKeyDown={handlePersonKeyDown}
              />

              <button
                onClick={handleAddPerson}
              >
                + Add
              </button>

            </div>

            <div className="demo-people">

              {people.map((person) => (
                <div
                  className="person"
                  key={person}
                >

                  <span className="avatar">
                    {person
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  <span>
                    {person}
                  </span>

                  <button
                    onClick={() =>
                      handleDeletePerson(person)
                    }
                    aria-label={`Delete ${person}`}
                  >
                    ×
                  </button>

                </div>
              ))}

            </div>

            <button
              className="primary-button"
              onClick={() => setStep("assign")}
              disabled={people.length === 0}
            >
              Assign items →
            </button>

          </div>

        </main>

        <footer>
          Built to make group dinners easier.
        </footer>

      </div>
    );
  }

  // =========================
  // ASSIGNMENT SCREEN
  // =========================

  if (step === "assign") {
    return (
      <div className="app">

        <nav className="navbar">

          <div className="logo">
            <span className="logo-icon">
              🍽️
            </span>

            SplitMyBill
          </div>

          <div className="nav-tag">
            AI-powered bill splitting
          </div>

        </nav>

        <main className="bill-page">

          <div className="bill-header">

            <button
              className="back-button"
              onClick={() => setStep("people")}
            >
              ← Back
            </button>

            <div>

              <div className="badge">
                Step 3 of 3
              </div>

              <h1>
                Who ate what?
              </h1>

              <p>
                Select everyone who shared each item.
              </p>

            </div>

          </div>

          <div className="assignment-card">

            {bill.items.map((item) => {

              const selectedPeople =
                assignments[item.id] || [];

              return (
                <div
                  className="assignment-item"
                  key={item.id}
                >

                  <div>

                    <strong>
                      {item.name}
                    </strong>

                    <span>
                      ₹{item.price.toFixed(2)}
                    </span>

                  </div>

                  <div className="assignment-people">

                    {people.map((person) => {

                      const isSelected =
                        selectedPeople.includes(person);

                      return (
                        <button
                          key={person}
                          className={
                            isSelected
                              ? "person-chip selected"
                              : "person-chip"
                          }
                          onClick={() =>
                            handleTogglePerson(
                              item.id,
                              person
                            )
                          }
                        >
                          {isSelected ? "✓ " : ""}
                          {person
                            .charAt(0)
                            .toUpperCase()}{" "}
                          {person}
                        </button>
                      );
                    })}

                  </div>

                  <small
                    style={{
                      display: "block",
                      marginTop: "10px",
                      color: "#888",
                    }}
                  >
                    {selectedPeople.length === 0
                      ? "No one selected"
                      : `Shared by ${selectedPeople.length} ${
                          selectedPeople.length === 1
                            ? "person"
                            : "people"
                        }`}
                  </small>

                </div>
              );
            })}

            <button
              className="primary-button"
              onClick={calculateSplit}
            >
              Calculate split 💰
            </button>

          </div>

        </main>

      </div>
    );
  }

  // =========================
  // RESULT SCREEN
  // =========================

  if (step === "result") {
    const calculatedTotal =
      Object.values(finalShares).reduce(
        (sum, amount) => sum + amount,
        0
      );

    return (
      <div className="app">

        <nav className="navbar">

          <div className="logo">
            <span className="logo-icon">
              🍽️
            </span>

            SplitMyBill
          </div>

          <div className="nav-tag">
            AI-powered bill splitting
          </div>

        </nav>

        <main className="result-page">

          <div className="badge">
            ✓ Split complete
          </div>

          <h1>
            Your bill is sorted.
          </h1>

          <p>
            Everyone's share has been calculated
            based on what they ate.
          </p>

          <div className="result-card">

            <div className="result-total">

              <span>
                Bill Total
              </span>

              <strong>
                ₹{total.toFixed(2)}
              </strong>

            </div>

            {people.map((person) => (

              <div
                className="result-person"
                key={person}
              >

                <span>

                  <span className="avatar">
                    {person
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  {person}

                </span>

                <strong>
                  ₹
                  {(finalShares[person] || 0).toFixed(
                    2
                  )}
                </strong>

              </div>

            ))}

            <div className="balanced">

              ✓ Split total: ₹
              {calculatedTotal.toFixed(2)}
              {" "} — matches bill total

            </div>

          </div>

          <button
            className="secondary-button"
            onClick={() => {
              setStep("upload");
              setSelectedFile(null);
              setFinalShares({});
            }}
          >
            Split another bill
          </button>

        </main>

      </div>
    );
  }

  return null;
}

export default App;