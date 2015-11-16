import a from "package-a";
import b from "package-b";

const c = (x, y, z) => a() + b() + 3;
export default c;

if (c() !== 7) {
  process.exit(1);
}
