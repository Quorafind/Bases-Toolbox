/** Provides an AST for complex queries. */
import type { Source } from "./source-types";
import type { Field } from "./field";

/** The supported query types (corresponding to view types). */
export type QueryType = "list" | "table" | "task" | "calendar";

/** A single-line comment. */
export type Comment = string;

/** Fields used in the query portion. */
export interface NamedField {
  /** The effective name of this field. */
  name: string;
  /** The value of this field. */
  field: Field;
}

/** A query sort by field, for determining sort order. */
export interface QuerySortBy {
  /** The field to sort on. */
  field: Field;
  /** The direction to sort in. */
  direction: "ascending" | "descending";
}

/** Utility functions for quickly creating fields. */
export namespace QueryFields {
  export function named(name: string, field: Field): NamedField {
    return { name, field } as NamedField;
  }

  export function sortBy(
    field: Field,
    dir: "ascending" | "descending"
  ): QuerySortBy {
    return { field, direction: dir };
  }
}

//////////////////////
// Query Definition //
//////////////////////

/** A query which should render a list of elements. */
export interface ListQuery {
  type: "list";
  /** What should be rendered in the list. */
  format?: Field;
  /** If true, show the default DI field; otherwise, don't. */
  showId: boolean;
}

/** A query which renders a table of elements. */
export interface TableQuery {
  type: "table";
  /** The fields (computed or otherwise) to select. */
  fields: NamedField[];
  /** If true, show the default ID field; otherwise, don't. */
  showId: boolean;
}

/** A query which renders a collection of tasks. */
export interface TaskQuery {
  type: "task";
}

/** A query which renders a collection of notes in a calendar view. */
export interface CalendarQuery {
  type: "calendar";
  /** The date field that we'll be grouping notes by for the calendar view */
  field: NamedField;
}

export type QueryHeader = ListQuery | TableQuery | TaskQuery | CalendarQuery;

/** A step which only retains rows whose 'clause' field is truthy. */
export interface WhereStep {
  type: "where";
  clause: Field;
}

/** A step which sorts all current rows by the given list of sorts. */
export interface SortByStep {
  type: "sort";
  fields: QuerySortBy[];
}

/** A step which truncates the number of rows to the given amount. */
export interface LimitStep {
  type: "limit";
  amount: Field;
}

/** A step which flattens rows into multiple child rows. */
export interface FlattenStep {
  type: "flatten";
  field: NamedField;
}

/** A step which groups rows into groups by the given field. */
export interface GroupStep {
  type: "group";
  field: NamedField;
}

/** A virtual step which extracts an array of values from each row. */
export interface ExtractStep {
  type: "extract";
  fields: Record<string, Field>;
}

export type QueryOperation =
  | WhereStep
  | SortByStep
  | LimitStep
  | FlattenStep
  | GroupStep
  | ExtractStep;

/**
 * A query over the Obsidian database. Queries have a specific and deterministic execution order:
 */
export interface Query {
  /** The view type to render this query in. */
  header: QueryHeader;
  /** The source that file candidates will come from. */
  source: Source;
  /** The operations to apply to the data to produce the final result that will be rendered. */
  operations: QueryOperation[];
}

/** Functional return type for error handling. */
export class Success<T, E> {
  public successful: true;

  public constructor(public value: T) {
    this.successful = true;
  }

  public map<U>(f: (a: T) => U): Result<U, E> {
    return new Success(f(this.value));
  }

  public flatMap<U>(f: (a: T) => Result<U, E>): Result<U, E> {
    return f(this.value);
  }

  public mapErr<U>(f: (e: E) => U): Result<T, U> {
    return this as any as Result<T, U>;
  }

  public bimap<T2, E2>(
    succ: (a: T) => T2,
    _fail: (b: E) => E2
  ): Result<T2, E2> {
    return this.map(succ) as any;
  }

  public orElse(_value: T): T {
    return this.value;
  }

  public cast<U>(): Result<U, E> {
    return this as any;
  }

  public orElseThrow(_message?: (e: E) => string): T {
    return this.value;
  }
}

/** Functional return type for error handling. */
export class Failure<T, E> {
  public successful: false;

  public constructor(public error: E) {
    this.successful = false;
  }

  public map<U>(_f: (a: T) => U): Result<U, E> {
    return this as any as Failure<U, E>;
  }

  public flatMap<U>(_f: (a: T) => Result<U, E>): Result<U, E> {
    return this as any as Failure<U, E>;
  }

  public mapErr<U>(f: (e: E) => U): Result<T, U> {
    return new Failure(f(this.error));
  }

  public bimap<T2, E2>(
    _succ: (a: T) => T2,
    fail: (b: E) => E2
  ): Result<T2, E2> {
    return this.mapErr(fail) as any;
  }

  public orElse(value: T): T {
    return value;
  }

  public cast<U>(): Result<U, E> {
    return this as any;
  }

  public orElseThrow(message?: (e: E) => string): T {
    if (message) throw new Error(message(this.error));
    else throw new Error("" + this.error);
  }
}

export type Result<T, E> = Success<T, E> | Failure<T, E>;

/** Monadic 'Result' type which encapsulates whether a procedure succeeded or failed, as well as it's return value. */
export namespace Result {
  /** Construct a new success result wrapping the given value. */
  export function success<T, E>(value: T): Result<T, E> {
    return new Success(value);
  }

  /** Construct a new failure value wrapping the given error. */
  export function failure<T, E>(error: E): Result<T, E> {
    return new Failure(error);
  }

  /** Join two results with a bi-function and return a new result. */
  export function flatMap2<T1, T2, O, E>(
    first: Result<T1, E>,
    second: Result<T2, E>,
    f: (a: T1, b: T2) => Result<O, E>
  ): Result<O, E> {
    if (first.successful) {
      if (second.successful) return f(first.value, second.value);
      else return failure(second.error);
    } else {
      return failure(first.error);
    }
  }

  /** Join two results with a bi-function and return a new result. */
  export function map2<T1, T2, O, E>(
    first: Result<T1, E>,
    second: Result<T2, E>,
    f: (a: T1, b: T2) => O
  ): Result<O, E> {
    return flatMap2(first, second, (a, b) => success(f(a, b)));
  }
}
