import emojiRegex from "emoji-regex";
import P from "parsimmon";

/** The Obsidian 'link', used for uniquely describing a file, header, or block. */
export class Link {
  /** The file path this link points to. */
  public path!: string;
  /** The display name associated with the link. */
  public display?: string;
  /** The block ID or header this link points to within a file, if relevant. */
  public subpath?: string;
  /** Is this link an embedded link (!)? */
  public embed!: boolean;
  /** The type of this link, which determines what 'subpath' refers to, if anything. */
  public type!: "file" | "header" | "block";

  /** Create a link to a specific file. */
  public static file(path: string, embed: boolean = false, display?: string) {
    return new Link({
      path,
      embed,
      display,
      subpath: undefined,
      type: "file",
    });
  }

  public static infer(
    linkpath: string,
    embed: boolean = false,
    display?: string
  ) {
    if (linkpath.includes("#^")) {
      let split = linkpath.split("#^");
      return Link.block(split[0], split[1], embed, display);
    } else if (linkpath.includes("#")) {
      let split = linkpath.split("#");
      return Link.header(split[0], split[1], embed, display);
    } else return Link.file(linkpath, embed, display);
  }

  /** Create a link to a specific file and header in that file. */
  public static header(
    path: string,
    header: string,
    embed?: boolean,
    display?: string
  ) {
    // Headers need to be normalized to alpha-numeric & with extra spacing removed.
    return new Link({
      path,
      embed,
      display,
      subpath: normalizeHeaderForLink(header),
      type: "header",
    });
  }

  /** Create a link to a specific file and block in that file. */
  public static block(
    path: string,
    blockId: string,
    embed?: boolean,
    display?: string
  ) {
    return new Link({
      path,
      embed,
      display,
      subpath: blockId,
      type: "block",
    });
  }

  public static fromObject(object: Record<string, any>) {
    return new Link(object);
  }

  private constructor(fields: Partial<Link>) {
    Object.assign(this, fields);
  }

  /** Checks for link equality (i.e., that the links are pointing to the same exact location). */
  public equals(other: Link): boolean {
    if (other == undefined || other == null) return false;

    return (
      this.path == other.path &&
      this.type == other.type &&
      this.subpath == other.subpath
    );
  }

  /** Convert this link to it's markdown representation. */
  public toString(): string {
    return this.markdown();
  }

  /** Convert this link to a raw object which is serialization-friendly. */
  public toObject(): Record<string, any> {
    return {
      path: this.path,
      type: this.type,
      subpath: this.subpath,
      display: this.display,
      embed: this.embed,
    };
  }

  /** Update this link with a new path. */
  //@ts-ignore; error appeared after updating Obsidian to 0.15.4; it also updated other packages but didn't say which
  public withPath(path: string) {
    return new Link(Object.assign({}, this, { path }));
  }

  /** Return a new link which points to the same location but with a new display value. */
  public withDisplay(display?: string) {
    return new Link(Object.assign({}, this, { display }));
  }

  /** Convert a file link into a link to a specific header. */
  public withHeader(header: string) {
    return Link.header(this.path, header, this.embed, this.display);
  }

  /** Convert any link into a link to its file. */
  public toFile() {
    return Link.file(this.path, this.embed, this.display);
  }

  /** Convert this link into an embedded link. */
  public toEmbed(): Link {
    if (this.embed) {
      return this;
    } else {
      let link = new Link(this);
      link.embed = true;
      return link;
    }
  }

  /** Convert this link into a non-embedded link. */
  public fromEmbed(): Link {
    if (!this.embed) {
      return this;
    } else {
      let link = new Link(this);
      link.embed = false;
      return link;
    }
  }

  /** Convert this link to markdown so it can be rendered. */
  public markdown(): string {
    let result = (this.embed ? "!" : "") + "[[" + this.obsidianLink();

    if (this.display) {
      result += "|" + this.display;
    } else {
      result += "|" + getFileTitle(this.path);
      if (this.type == "header" || this.type == "block")
        result += " > " + this.subpath;
    }

    result += "]]";
    return result;
  }

  /** Convert the inner part of the link to something that Obsidian can open / understand. */
  public obsidianLink(): string {
    const escaped = this.path.replaceAll("|", "\\|");
    if (this.type == "header")
      return escaped + "#" + this.subpath?.replaceAll("|", "\\|");
    if (this.type == "block")
      return escaped + "#^" + this.subpath?.replaceAll("|", "\\|");
    else return escaped;
  }

  /** The stripped name of the file this link points to. */
  public fileName(): string {
    return getFileTitle(this.path).replace(".md", "");
  }
}

/** Get the "title" for a file, by stripping other parts of the path as well as the extension. */
export function getFileTitle(path: string): string {
  if (path.includes("/")) path = path.substring(path.lastIndexOf("/") + 1);
  if (path.endsWith(".md")) path = path.substring(0, path.length - 3);
  return path;
}

const HEADER_CANONICALIZER: P.Parser<string> = P.alt(
  P.regex(new RegExp(emojiRegex(), "")),
  P.regex(/[0-9\p{Letter}_-]+/u),
  P.whitespace.map((_) => " "),
  P.any.map((_) => " ")
)
  .many()
  .map((result) => {
    return result.join("").split(/\s+/).join(" ").trim();
  });

export function normalizeHeaderForLink(header: string): string {
  return HEADER_CANONICALIZER.tryParse(header);
}
