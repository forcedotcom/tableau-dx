# Drilldown ERD — Intermediate Calc Injection (1-Level Depth)

## The Problem

When drilling down into a data object (e.g., User), the ERD shows all entities (calc dimensions, calc measurements, metrics, etc.) that are related to that object. Some of these are **cross-object** — they reference multiple objects in their expression.

For example, `My_First_Contact_Resolution_Percentage_SI_clc` has the expression:

```
SUM(If LEFT([User].[User_Id],15) = USERID15() then [FCR_Flag_clc] END)
/ COUNTD(If LEFT([User].[User_Id],15) = USERID15() then [Total_Cases_Closed_clc] END)
```

This calc references **User** (the drilled-into object) and two other calcs: `FCR_Flag_clc` and `Total_Cases_Closed_clc`. Those two calcs are exclusive to **Case** — they don't reference User at all. Without injection, they wouldn't appear in the User drilldown, and the ERD would show `My_First...` connecting directly to the Case edge object, skipping the intermediate calcs entirely.

## The Solution: 1-Level Injection

We inject **missing intermediate calcs** that are directly referenced by the original drilldown entities. This adds exactly one level of depth — the calcs that the original entities call, but not the calcs that *those* calcs call.

### What the User Sees in the ERD

```
User (center)
  ← My_First_Contact_Resolution_Percentage_SI_clc (original, cross-object)
       → FCR_Flag_clc (injected, level 1) → Case
       → Total_Cases_Closed_clc (injected, level 1) → Case
```

`FCR_Flag_clc` itself references `[Case].[Closed]` and `[Email_Count_clc]`, but `Email_Count_clc` is NOT shown in the ERD (it would be level 2).

### What the User Sees in the Sidebar (Dependency Chain)

The sidebar always shows the **full dependency tree**, regardless of depth:

```
My First Contact Resolution Percentage
├── User.User_Id (Object Field)
├── FCR Flag (Calc Dimension)
│   ├── Case.Closed (Object Field)
│   └── Email Count (Calc Dimension)
│       └── Email_Message.Email_Message_Id (Object Field)
└── Total Cases Closed (Calc Measurement)
    └── Case.Case_Id (Object Field)
```

## Why Not Deeper Injection?

We tested deeper injection (unlimited recursion) and it caused a cascade problem. For example, drilling into **User**:


| Injection Depth         | Nodes Added | What Happens                                                                                   |
| ----------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| **0 levels** (original) | 0           | Cross-object calcs connect directly to edge objects — missing intermediates, arrows skip calcs |
| **1 level** (current)   | ~5-10       | Immediate intermediates shown — readable, correct chains for direct dependencies               |
| **2 levels**            | ~15-25      | Business-hours calcs from Case (FC_Day_Difference, FC_Same_Day, FC_Multi_Day, etc.) flood in   |
| **Unlimited**           | 30-50+      | The entire Case/Case_Update dependency tree appears in the User drilldown — unreadable         |


The deeper chains are about Case-internal logic (business hours calculations, date differences, etc.) that have nothing to do with User. Showing them makes the User drilldown unreadable and confusing.

## Summary


| View                         | Depth      | Purpose                                                                |
| ---------------------------- | ---------- | ---------------------------------------------------------------------- |
| **ERD graph**                | 1 level    | Visual overview — shows direct intermediates, keeps it readable        |
| **Sidebar Dependency Chain** | Full depth | Detailed exploration — shows the complete tree for any selected entity |


This gives the best of both worlds: the ERD stays clean and focused on the drilled-into object's direct relationships, while the sidebar provides full traceability for anyone who needs to dig deeper.

## Future Enhancement: User-Controlled Depth

Instead of a fixed 1-level limit, we can let the user choose how many levels of intermediates to show in the ERD. This would be a simple control in the UI (e.g., a dropdown or +/- buttons) with options like: **1** (default), **2**, **3**, or **All**.

### How It Would Work

- Default view starts at depth 1 — clean and focused
- User increases depth to 2 or 3 to explore deeper chains when needed
- User can go back to 1 if the view gets too crowded
- The sidebar Dependency Chain always shows the full tree regardless of the selected depth

### Benefits

- **No guessing** — the user decides the right level of detail for their context
- **Interactive exploration** — start clean, drill deeper only where needed
- **Best of both worlds** — simple default for most cases, full power when needed

### Technical Feasibility

The injection code already supports this — it's a matter of running the injection loop N times instead of once. Each iteration scans the newly added entities from the previous round. The graph re-layouts automatically when the depth changes. Low implementation effort.