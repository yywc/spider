export default class User {
  public name: string;
  public level: string;
  public job: string;
  public company: string;
  public motto: string;
  public like: string;
  public read: string;
  public value: string;

  public constructor(
    name: string,
    level: string,
    job: string,
    company: string,
    motto: string,
    like: string,
    read: string,
    value: string,
  ) {
    this.name = name;
    this.level = level;
    this.job = job;
    this.company = company;
    this.motto = motto;
    this.like = like;
    this.read = read;
    this.value = value;
  }
}