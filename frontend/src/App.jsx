import { useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [step, setStep] = useState("upload");
  const [selectedFile, setSelectedFile] = useState(null);
  const [bill, setBill] = useState(null);
  const [people, setPeople] = useState([
    "Akshita",
    "Ishika",
    "Harshit",
    "Vidhi",
  ]);
  const [newPerson, setNewPerson] = useState("");
  const [assignments, setAssignments] = useState({});
  const [finalShares, setFinalShares] = useState({});
  const [shareBreakdown, setShareBreakdown] = useState({});
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // -----------------------------
  // FILE UPLOAD
  // -----------------------------

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setSelectedFile(null);
      setError("Please upload a JPG, PNG, or WEBP image.");
      return;
    }

    setSelectedFile(file);
    setError("");
  };

  // -----------------------------
  // PROCESS BILL
  // -----------------------------

  const handleContinue = async () => {
    if (!selectedFile) {
      setError("Please select a bill image first.");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        `${API_URL}/process-bill`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}`
        );
      }

      const data = await response.json();

      if (!data.success || !data.bill) {
        throw new Error(
          data.message || "Unable to process bill."
        );
      }

      setBill(data.bill);

      const initialAssignments = {};

      data.bill.items.forEach((item) => {
        initialAssignments[item.id] = [];
      });

      setAssignments(initialAssignments);

      setStep("bill");
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Something went wrong while processing the bill."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // -----------------------------
  // PEOPLE
  // -----------------------------

  const handleAddPerson = () => {
    const name = newPerson.trim();

    if (!name) {
      setError("Please enter a name.");
      return;
    }

    const exists = people.some(
      (person) =>
        person.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      setError("This person is already added.");
      return;
    }

    setPeople((current) => [
      ...current,
      name,
    ]);

    setNewPerson("");
    setError("");
  };

  const handleDeletePerson = (name) => {
    if (people.length === 1) {
      setError("At least one person is required.");
      return;
    }

    setPeople((current) =>
      current.filter(
        (person) => person !== name
      )
    );

    setAssignments((current) => {
      const updated = {};

      Object.keys(current).forEach((itemId) => {
        updated[itemId] = current[itemId].filter(
          (person) => person !== name
        );
      });

      return updated;
    });

    setError("");
  };

  const handlePersonKeyDown = (event) => {
    if (event.key === "Enter") {
      handleAddPerson();
    }
  };

  // -----------------------------
  // ASSIGN PEOPLE TO ITEM
  // -----------------------------

  const handleTogglePerson = (
    itemId,
    person
  ) => {
    setAssignments((current) => {
      const selected =
        current[itemId] || [];

      const alreadySelected =
        selected.includes(person);

      return {
        ...current,
        [itemId]: alreadySelected
          ? selected.filter(
              (name) => name !== person
            )
          : [...selected, person],
      };
    });

    setError("");
  };

  // -----------------------------
  // EDIT BILL ITEM
  // -----------------------------

  const handleItemChange = (itemId, field, value) => {
    setBill((current) => {
      if (!current) return current;

      const updatedItems = current.items.map((item) => {
        if (item.id !== itemId) return item;

        if (field === "name") {
          return { ...item, name: value };
        }

        const numericValue = Number(value);

        return {
          ...item,
          [field]: Number.isFinite(numericValue) && numericValue >= 0
            ? numericValue
            : 0,
        };
      });

      return {
        ...current,
        items: updatedItems,
      };
    });

    setError("");
  };

  // -----------------------------
  // CALCULATE SPLIT
  // -----------------------------

  const calculateSplit = () => {
    if (!bill) return;

    // Check for unassigned items
    const unassignedItems =
      bill.items.filter((item) => {
        const selectedPeople =
          assignments[item.id] || [];

        return selectedPeople.length === 0;
      });

    if (unassignedItems.length > 0) {
      const itemNames =
        unassignedItems
          .map((item) => item.name)
          .join(", ");

      setError(
        `Please assign every item before calculating. Unassigned: ${itemNames}`
      );

      return;
    }

    // Track each person's food subtotal before extra charges
    const itemShares = {};

    people.forEach((person) => {
      itemShares[person] = 0;
    });

    bill.items.forEach((item) => {
      const selectedPeople =
        assignments[item.id];

      const sharePerPerson =
        item.price /
        selectedPeople.length;

      selectedPeople.forEach((person) => {
        itemShares[person] +=
          sharePerPerson;
      });
    });

    // Calculate subtotal
    const subtotal =
      bill.items.reduce(
        (sum, item) =>
          sum + item.price,
        0
      );

    // Service charge + GST
    const additionalCharges =
      bill.service_charge +
      bill.gst;

    // Distribute extra charges proportionally
    const shares = {};

    people.forEach((person) => {
      const foodShare =
        itemShares[person];

      const proportion =
        subtotal > 0
          ? foodShare / subtotal
          : 0;

      shares[person] =
        foodShare +
        additionalCharges *
          proportion;
    });

    // Round values
    const roundedShares = {};

    people.forEach((person) => {
      roundedShares[person] =
        Math.round(
          shares[person] * 100
        ) / 100;
    });

    // Grand total
    const grandTotal =
      subtotal +
      bill.service_charge +
      bill.gst;

    // Handle rounding difference
    const calculatedTotal =
      Object.values(
        roundedShares
      ).reduce(
        (sum, value) =>
          sum + value,
        0
      );

    const difference =
      Math.round(
        (grandTotal -
          calculatedTotal) *
          100
      ) / 100;

    if (
      people.length > 0 &&
      difference !== 0
    ) {
      const lastPerson =
        people[people.length - 1];

      roundedShares[lastPerson] =
        Math.round(
          (roundedShares[lastPerson] +
            difference) *
            100
        ) / 100;
    }

    // Build a transparent breakdown for the result screen.
    const breakdown = {};

    people.forEach((person) => {
      const personItems =
        Math.round(
          itemShares[person] * 100
        ) / 100;

      breakdown[person] = {
        items: personItems,
        charges:
          Math.round(
            (roundedShares[person] -
              personItems) *
              100
          ) / 100,
        total: roundedShares[person],
      };
    });

    setFinalShares(roundedShares);
    setShareBreakdown(breakdown);
    setError("");
    setStep("result");
  };

  // -----------------------------
  // UPLOAD SCREEN
  // -----------------------------

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
                accept="image/jpeg,image/png,image/webp"
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

              {error && (
                <p className="error-message">
                  {error}
                </p>
              )}

              {selectedFile && (
                <button
                  className="continue-button"
                  onClick={handleContinue}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? "Reading bill..."
                    : "Continue →"}
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

  // -----------------------------
  // BILL REVIEW SCREEN
  // -----------------------------

  if (step === "bill") {

    if (!bill) return null;

    const subtotal =
      bill.items.reduce(
        (sum, item) =>
          sum + item.price,
        0
      );

    const total =
      subtotal +
      bill.service_charge +
      bill.gst;

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
              onClick={() =>
                setStep("upload")
              }
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
                We found these items.
                Check the details before splitting.
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

            <p className="edit-hint">
              ✏️ You can edit the item name, quantity, or price before splitting.
            </p>

            <div className="items-list">

              {bill.items.map((item) => (
                <div
                  className="bill-item"
                  key={item.id}
                >

                  <div className="editable-item">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) =>
                        handleItemChange(
                          item.id,
                          "name",
                          event.target.value
                        )
                      }
                      aria-label={`Item name for ${item.name}`}
                    />
                  </div>

                  <input
                    className="editable-quantity"
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) =>
                      handleItemChange(
                        item.id,
                        "quantity",
                        event.target.value
                      )
                    }
                    aria-label={`Quantity for ${item.name}`}
                  />

                  <div className="editable-price">
                    <span>₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onFocus={(event) => event.target.select()}
                      onChange={(event) =>
                        handleItemChange(
                          item.id,
                          "price",
                          event.target.value
                        )
                      }
                      aria-label={`Price for ${item.name}`}
                    />
                  </div>

                </div>
              ))}

            </div>

            <div className="bill-summary">

              <div>
                <span>
                  Subtotal
                </span>

                <strong>
                  ₹
                  {subtotal.toFixed(2)}
                </strong>
              </div>

              <div>
                <span>
                  Service Charge
                </span>

                <strong>
                  ₹
                  {bill.service_charge.toFixed(2)}
                </strong>
              </div>

              <div>
                <span>
                  GST
                </span>

                <strong>
                  ₹
                  {bill.gst.toFixed(2)}
                </strong>
              </div>

              <div className="grand-total">

                <span>
                  Grand Total
                </span>

                <strong>
                  ₹
                  {total.toFixed(2)}
                </strong>

              </div>

            </div>

            <button
              className="primary-button"
              onClick={() =>
                setStep("people")
              }
            >
              Looks good — Add people →
            </button>

          </div>

        </main>

      </div>
    );
  }

  // -----------------------------
  // PEOPLE SCREEN
  // -----------------------------

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
              onClick={() =>
                setStep("bill")
              }
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
                  setNewPerson(
                    event.target.value
                  )
                }
                onKeyDown={
                  handlePersonKeyDown
                }
              />

              <button
                onClick={handleAddPerson}
              >
                + Add
              </button>

            </div>

            {error && (
              <p className="error-message">
                {error}
              </p>
            )}

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
                      handleDeletePerson(
                        person
                      )
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
              onClick={() =>
                setStep("assign")
              }
            >
              Assign items →
            </button>

          </div>

        </main>

      </div>
    );
  }

  // -----------------------------
  // ASSIGNMENT SCREEN
  // -----------------------------

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
              onClick={() =>
                setStep("people")
              }
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

                  <div className="assignment-header">

                    <strong>
                      {item.name}
                    </strong>

                    <span>
                      ₹
                      {item.price.toFixed(2)}
                    </span>

                  </div>

                  <div className="assignment-people">

                    {people.map((person) => {

                      const selected =
                        selectedPeople.includes(
                          person
                        );

                      return (
                        <button
                          key={person}
                          className={
                            selected
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
                          {selected
                            ? "✓ "
                            : ""}

                          {person
                            .charAt(0)
                            .toUpperCase()}

                          {" "}

                          {person}
                        </button>
                      );
                    })}

                  </div>

                  <small>

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

            {error && (
              <p className="error-message">
                {error}
              </p>
            )}

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

  // -----------------------------
  // RESULT SCREEN
  // -----------------------------

  if (step === "result") {

    if (!bill) return null;

    const subtotal =
      bill.items.reduce(
        (sum, item) =>
          sum + item.price,
        0
      );

    const total =
      subtotal +
      bill.service_charge +
      bill.gst;

    const calculatedTotal =
      Object.values(finalShares).reduce(
        (sum, amount) =>
          sum + amount,
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
                ₹
                {total.toFixed(2)}
              </strong>

            </div>

            {people.map((person) => {
              const breakdown =
                shareBreakdown[person] || {
                  items: 0,
                  charges: 0,
                  total: finalShares[person] || 0,
                };

              return (
                <div
                  className="result-person"
                  key={person}
                >

                  <div className="result-person-info">

                    <div className="result-person-name">
                      <span className="avatar">
                        {person
                          .charAt(0)
                          .toUpperCase()}
                      </span>

                      <strong>
                        {person}
                      </strong>
                    </div>

                    <div className="result-breakdown">
                      <span>
                        Items
                        <strong>
                          ₹{breakdown.items.toFixed(2)}
                        </strong>
                      </span>

                      <span>
                        GST + Service
                        <strong>
                          ₹{breakdown.charges.toFixed(2)}
                        </strong>
                      </span>
                    </div>

                  </div>

                  <strong className="result-person-total">
                    ₹{breakdown.total.toFixed(2)}
                  </strong>

                </div>
              );
            })}

            <div className="balanced">

              ✓ Split total: ₹
              {calculatedTotal.toFixed(2)}
              {" "}
              — matches bill total

            </div>

          </div>

          <button
            className="secondary-button"
            onClick={() => {

              setStep("upload");
              setSelectedFile(null);
              setBill(null);
              setAssignments({});
              setFinalShares({});
              setShareBreakdown({});
              setError("");

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