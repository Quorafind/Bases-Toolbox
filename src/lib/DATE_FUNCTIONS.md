# Dataview to Bases Date Function Conversion

This document explains how Dataview date expressions are converted to Bases date functions.

## Supported Date Conversions

| Dataview Syntax                           | Bases Syntax                   | Description                     |
| ----------------------------------------- | ------------------------------ | ------------------------------- |
| `date(today)`                             | `now()`                        | Current date and time           |
| `date(yesterday)`                         | `dateModify(now(), "-1 day")`  | Yesterday's date                |
| `date(tomorrow)`                          | `dateModify(now(), "1 day")`   | Tomorrow's date                 |
| `dur(N days)`                             | `"N days"`                     | Duration of N days              |
| `dur(N weeks)`                            | `"N weeks"`                    | Duration of N weeks             |
| `dur(N months)`                           | `"N months"`                   | Duration of N months            |
| `expr + dur(N units)`                     | `dateModify(expr, "N units")`  | Add a duration to a date        |
| `expr - dur(N units)`                     | `dateModify(expr, "-N units")` | Subtract a duration from a date |
| `now() + "N units"` or `expr + "N units"` | `dateModify(expr, "N units")`  | Add a string duration to a date |
| `now() - "N units"` or `expr - "N units"` | `dateModify(expr, "-N units")` | Subtract a string duration      |

## Examples

### Example 1: Due date within the next week

**Dataview:**

```
due >= date(today) AND due <= date(today) + dur(7 days)
```

**Bases:**

```
due >= now() AND due <= dateModify(now(), "7 days")
```

### Example 2: Completed yesterday

**Dataview:**

```
completion = date(yesterday)
```

**Bases:**

```
completion == dateModify(now(), "-1 day")
```

### Example 3: Starting within the past two weeks

**Dataview:**

```
start_date >= date(today) - dur(2 weeks)
```

**Bases:**

```
start_date >= dateModify(now(), "-2 weeks")
```

### Example 4: Due tomorrow

**Dataview:**

```
deadline < date(tomorrow)
```

**Bases:**

```
deadline < dateModify(now(), "1 day")
```

### Example 5: Expression with date first

**Dataview:**

```
(date(today) + dur(5 days)) > due_date
```

**Bases:**

```
dateModify(now(), "5 days") > due_date
```

### Example 6: Field with already converted duration

**Dataview (after partial conversion):**

```
due >= now() AND due <= now() + "7 days"
```

**Final Bases:**

```
due >= now() AND due <= dateModify(now(), "7 days")
```

## Multi-Stage Processing Explained

The date conversion happens in two stages:

1. First, Dataview date functions are converted:

   - `date(today)` becomes `now()`
   - `date(tomorrow)` becomes `dateModify(now(), "1 day")`
   - `date(yesterday)` becomes `dateModify(now(), "-1 day")`
   - `dur(7 days)` becomes `"7 days"`

2. Then, date math expressions are converted:
   - `now() + "7 days"` becomes `dateModify(now(), "7 days")`
   - `date_field - "2 weeks"` becomes `dateModify(date_field, "-2 weeks")`
   - `date(today) + dur(3 months)` becomes `dateModify(now(), "3 months")`

This multi-stage process ensures all date calculations are properly converted to Bases format.

## Available Bases Date Functions

All of these Bases date functions are supported:

- `now()` - Returns the current date and time
- `dateModify(datetime, duration)` - Modifies a date by a duration
- `date_diff(datetime1, datetime2)` - Gets the difference between two dates in milliseconds
- `date_equals(datetime1, datetime2)` - Checks if two dates are equal
- `date_not_equals(datetime1, datetime2)` - Checks if two dates are not equal
- `date_before(datetime1, datetime2)` - Checks if the first date is before the second
- `date_after(datetime1, datetime2)` - Checks if the first date is after the second
- `date_on_or_before(datetime1, datetime2)` - Checks if the first date is on or before the second
- `date_on_or_after(datetime1, datetime2)` - Checks if the first date is on or after the second
- `year(date)` - Gets the year from a date
- `month(date)` - Gets the month from a date
- `day(date)` - Gets the day from a date
- `hour(datetime)` - Gets the hour from a date
- `minute(datetime)` - Gets the minute from a date
- `second(datetime)` - Gets the second from a date
