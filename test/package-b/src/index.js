import a from "package-a";

const b = (x, y, z) => a() + 2;
export default b;

if (b() !== 3) {
  process.exit(1);
}
