/* =========================================================
   POWNIN ADVANCED MATH ENGINE v3.0
   PART 1/3 — CORE + EXPRESSION PARSER
   ========================================================= */

(function () {
    "use strict";

    const VERSION = "3.0";
    const MAX_LENGTH = 500;
    const MAX_TOKENS = 250;
    const MAX_RESULT = 1e100;
    const EPSILON = 1e-12;

    // -------------------------------------------------------
    // 1. NUMBER NORMALIZATION
    // -------------------------------------------------------

    function normalizeDigits(text) {
        const bn = "০১২৩৪৫৬৭৮৯";
        const hi = "०१२३४५६७८९";

        return String(text).replace(/[০-৯०-९]/g, function (d) {
            let i = bn.indexOf(d);
            if (i >= 0) return String(i);

            i = hi.indexOf(d);
            return i >= 0 ? String(i) : d;
        });
    }

    function normalizeText(text) {
        let s = normalizeDigits(text)
            .toLowerCase()
            .trim();

        const replacements = [
            [/\bmultiplied by\b/g, "*"],
            [/\btimes\b/g, "*"],
            [/\binto\b/g, "*"],
            [/\bdivided by\b/g, "/"],
            [/\bdivided\b/g, "/"],
            [/\bplus\b/g, "+"],
            [/\badded to\b/g, "+"],
            [/\bminus\b/g, "-"],
            [/\bsubtract\b/g, "-"],
            [/\bmodulo\b/g, "%"],
            [/\bmod\b/g, "%"],
            [/\bpower of\b/g, "^"],
            [/\bsquared\b/g, "^2"],
            [/\bcubed\b/g, "^3"],
            [/যোগ/g, "+"],
            [/বিয়োগ/g, "-"],
            [/বিয়োগ/g, "-"],
            [/গুণ/g, "*"],
            [/ভাগ/g, "/"],
            [/जोड़/g, "+"],
            [/जोड़ो/g, "+"],
            [/घटाव/g, "-"],
            [/गुणा/g, "*"],
            [/भाग/g, "/"]
        ];

        for (const [pattern, replacement] of replacements) {
            s = s.replace(pattern, replacement);
        }

        return s.trim();
    }

    // -------------------------------------------------------
    // 2. SAFE RESULT CHECK
    // -------------------------------------------------------

    function checked(value) {
        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            Math.abs(value) > MAX_RESULT
        ) {
            throw new Error("Result out of range");
        }

        return value;
    }

    function cleanNumber(value) {
        checked(value);

        if (Math.abs(value) < EPSILON) return 0;

        if (Number.isInteger(value)) return value;

        return Number(value.toPrecision(12));
    }

    // -------------------------------------------------------
    // 3. MATHEMATICAL FUNCTIONS
    // -------------------------------------------------------

    function factorial(n) {
        if (!Number.isInteger(n) || n < 0 || n > 170) {
            throw new Error("Factorial requires integer 0 to 170");
        }

        let result = 1;

        for (let i = 2; i <= n; i++) {
            result *= i;
        }

        return checked(result);
    }

    function gcd(a, b) {
        a = Math.abs(Math.trunc(a));
        b = Math.abs(Math.trunc(b));

        while (b !== 0) {
            const t = b;
            b = a % b;
            a = t;
        }

        return a;
    }

    function lcm(a, b) {
        if (!Number.isInteger(a) || !Number.isInteger(b)) {
            throw new Error("LCM requires integers");
        }

        if (a === 0 || b === 0) return 0;

        return checked(Math.abs((a / gcd(a, b)) * b));
    }

    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    function mathFunction(name, args) {
        const x = args[0];

        switch (name) {
            case "sin":
                return Math.sin(toRadians(x));

            case "cos":
                return Math.cos(toRadians(x));

            case "tan":
                if (Math.abs(Math.cos(toRadians(x))) < EPSILON) {
                    throw new Error("Tan is undefined");
                }
                return Math.tan(toRadians(x));

            case "cot":
                if (Math.abs(Math.sin(toRadians(x))) < EPSILON) {
                    throw new Error("Cot is undefined");
                }
                return 1 / Math.tan(toRadians(x));

            case "sec":
                if (Math.abs(Math.cos(toRadians(x))) < EPSILON) {
                    throw new Error("Sec is undefined");
                }
                return 1 / Math.cos(toRadians(x));

            case "cosec":
            case "csc":
                if (Math.abs(Math.sin(toRadians(x))) < EPSILON) {
                    throw new Error("Cosec is undefined");
                }
                return 1 / Math.sin(toRadians(x));

            case "asin":
                return Math.asin(x) * 180 / Math.PI;

            case "acos":
                return Math.acos(x) * 180 / Math.PI;

            case "atan":
                return Math.atan(x) * 180 / Math.PI;

            case "sqrt":
                if (x < 0) throw new Error("Invalid square root");
                return Math.sqrt(x);

            case "cbrt":
                return Math.cbrt(x);

            case "abs":
                return Math.abs(x);

            case "floor":
                return Math.floor(x);

            case "ceil":
                return Math.ceil(x);

            case "round":
                return Math.round(x);

            case "log":
                if (x <= 0) throw new Error("Log requires positive number");

                if (args.length > 1) {
                    const base = args[1];

                    if (base <= 0 || base === 1) {
                        throw new Error("Invalid logarithm base");
                    }

                    return Math.log(x) / Math.log(base);
                }

                return Math.log10(x);

            case "ln":
                if (x <= 0) throw new Error("Ln requires positive number");
                return Math.log(x);

            case "exp":
                return Math.exp(x);

            case "min":
                return Math.min.apply(null, args);

            case "max":
                return Math.max.apply(null, args);

            case "gcd":
                return gcd(x, args[1]);

            case "lcm":
                return lcm(x, args[1]);

            case "fact":
            case "factorial":
                return factorial(x);

            default:
                throw new Error("Unknown function: " + name);
        }
    }

    // -------------------------------------------------------
    // 4. TOKENIZER
    // -------------------------------------------------------

    function tokenize(expression) {
        const tokens = [];
        let position = 0;

        while (position < expression.length) {
            const rest = expression.slice(position);

            if (/^\s+/.test(rest)) {
                position += rest.match(/^\s+/)[0].length;
                continue;
            }

            const number = rest.match(
                /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i
            );

            if (number) {
                tokens.push({
                    type: "number",
                    value: Number(number[0])
                });

                position += number[0].length;
                continue;
            }

            const identifier = rest.match(/^[a-z]+/i);

            if (identifier) {
                tokens.push({
                    type: "identifier",
                    value: identifier[0].toLowerCase()
                });

                position += identifier[0].length;
                continue;
            }

            const character = rest[0];

            if ("+-*/%^(),!".includes(character)) {
                tokens.push({
                    type: "operator",
                    value: character
                });

                position++;
                continue;
            }

            throw new Error("Invalid mathematical character");
        }

        if (tokens.length > MAX_TOKENS) {
            throw new Error("Too many mathematical tokens");
        }

        return tokens;
    }

    // -------------------------------------------------------
    // 5. EXPRESSION PARSER
    // -------------------------------------------------------

    function parseExpression(tokens) {
        let index = 0;

        function peek() {
            return tokens[index] || null;
        }

        function consume(value) {
            if (peek() && peek().value === value) {
                index++;
                return true;
            }

            return false;
        }

        function startsPrimary(token) {
            return token && (
                token.type === "number" ||
                token.type === "identifier" ||
                token.value === "("
            );
        }

        function primary() {
            const token = peek();

            if (!token) {
                throw new Error("Expression incomplete");
            }

            if (consume("(")) {
                const value = expression();

                if (!consume(")")) {
                    throw new Error("Missing closing bracket");
                }

                return value;
            }

            if (token.type === "number") {
                index++;
                return checked(token.value);
            }

            if (token.type === "identifier") {
                index++;

                const name = token.value;

                if (name === "pi") return Math.PI;
                if (name === "e") return Math.E;

                if (!consume("(")) {
                    throw new Error("Function requires brackets");
                }

                const args = [];

                if (!consume(")")) {
                    args.push(expression());

                    while (consume(",")) {
                        args.push(expression());
                    }

                    if (!consume(")")) {
                        throw new Error("Missing function bracket");
                    }
                }

                if (!args.length) {
                    throw new Error("Function argument missing");
                }

                return checked(mathFunction(name, args));
            }

            throw new Error("Number expected");
        }

        function postfix() {
            let value = primary();

            while (consume("!")) {
                value = factorial(value);
            }

            return value;
        }

        function power() {
            let value = postfix();

            if (consume("^")) {
                const exponent = unary();
                value = checked(Math.pow(value, exponent));
            }

            return value;
        }

        function unary() {
            if (consume("+")) return unary();
            if (consume("-")) return -unary();

            return power();
        }

        function term() {
            let value = unary();

            while (true) {
                const token = peek();

                if (!token) break;

                if (["*", "/", "%"].includes(token.value)) {
                    const operator = token.value;
                    index++;

                    const right = unary();

                    if (
                        (operator === "/" || operator === "%") &&
                        right === 0
                    ) {
                        throw new Error("Division by zero");
                    }

                    if (operator === "*") value *= right;
                    if (operator === "/") value /= right;
                    if (operator === "%") value %= right;

                    value = checked(value);
                    continue;
                }

                // Implicit multiplication: 2(3), 2pi, 2sin(30)
                if (startsPrimary(token)) {
                    value = checked(value * unary());
                    continue;
                }

                break;
            }

            return value;
        }

        function expression() {
            let value = term();

            while (peek()) {
                const operator = peek().value;

                if (operator !== "+" && operator !== "-") {
                    break;
                }

                index++;

                const right = term();

                value = operator === "+"
                    ? value + right
                    : value - right;

                value = checked(value);
            }

            return value;
        }

        const result = expression();

        if (index !== tokens.length) {
            throw new Error("Unexpected mathematical input");
        }

        return checked(result);
    }

    // PART 1 END
    // PART 2 WILL BE ADDED BELOW


/* =========================================================
   POWNIN ADVANCED MATH ENGINE v3.0
   PART 2/3 — ADVANCED ARITHMETIC SOLVERS
   ========================================================= */

    // -------------------------------------------------------
    // 6. INTEGER VALIDATION
    // -------------------------------------------------------

    function validInteger(n) {
        return Number.isSafeInteger(n);
    }

    function requirePositive(n, name) {
        if (!Number.isFinite(n) || n <= 0) {
            throw new Error(name + " must be positive");
        }
    }

    // -------------------------------------------------------
    // 7. LCM / HCF
    // -------------------------------------------------------

    function solveLCM(a, b) {
        if (!validInteger(a) || !validInteger(b)) {
            throw new Error("LCM requires safe integers");
        }

        return lcm(a, b);
    }

    function solveHCF(a, b) {
        if (!validInteger(a) || !validInteger(b)) {
            throw new Error("HCF requires safe integers");
        }

        return gcd(a, b);
    }

    // -------------------------------------------------------
    // 8. FRACTIONS
    // -------------------------------------------------------

    function fraction(a, b) {
        if (!validInteger(a) || !validInteger(b) || b === 0) {
            throw new Error("Invalid fraction");
        }

        if (b < 0) {
            a = -a;
            b = -b;
        }

        const divisor = gcd(a, b);

        return {
            numerator: a / divisor,
            denominator: b / divisor,
            decimal: a / b
        };
    }

    function fractionOperation(a, b, c, d, operation) {
        if (![a, b, c, d].every(validInteger) || b === 0 || d === 0) {
            throw new Error("Invalid fraction values");
        }

        let numerator;
        let denominator;

        if (operation === "+") {
            numerator = a * d + c * b;
            denominator = b * d;
        } else if (operation === "-") {
            numerator = a * d - c * b;
            denominator = b * d;
        } else if (operation === "*") {
            numerator = a * c;
            denominator = b * d;
        } else if (operation === "/") {
            if (c === 0) throw new Error("Division by zero");
            numerator = a * d;
            denominator = b * c;
        } else {
            throw new Error("Unknown fraction operation");
        }

        if (!Number.isSafeInteger(numerator) ||
            !Number.isSafeInteger(denominator)) {
            throw new Error("Fraction is too large");
        }

        return fraction(numerator, denominator);
    }

    // -------------------------------------------------------
    // 9. PERCENTAGE
    // -------------------------------------------------------

    function percentage(value, total) {
        if (total === 0) {
            throw new Error("Total cannot be zero");
        }

        return checked((value / total) * 100);
    }

    function percentageOf(percent, value) {
        return checked((percent / 100) * value);
    }

    function percentageChange(oldValue, newValue) {
        if (oldValue === 0) {
            throw new Error("Old value cannot be zero");
        }

        return checked(
            ((newValue - oldValue) / Math.abs(oldValue)) * 100
        );
    }

    // -------------------------------------------------------
    // 10. RATIO
    // -------------------------------------------------------

    function simplifyRatio(a, b) {
        if (!validInteger(a) || !validInteger(b) || (a === 0 && b === 0)) {
            throw new Error("Invalid ratio");
        }

        const divisor = gcd(a, b);

        return {
            first: a / divisor,
            second: b / divisor
        };
    }

    function divideInRatio(total, a, b) {
        if (a < 0 || b < 0 || a + b === 0) {
            throw new Error("Invalid ratio");
        }

        return {
            first: checked(total * a / (a + b)),
            second: checked(total * b / (a + b))
        };
    }

    // -------------------------------------------------------
    // 11. PROFIT / LOSS / DISCOUNT
    // -------------------------------------------------------

    function profitLoss(costPrice, sellingPrice) {
        if (costPrice <= 0 || sellingPrice < 0) {
            throw new Error("Invalid price");
        }

        const difference = sellingPrice - costPrice;

        return {
            amount: Math.abs(difference),
            percentage: checked(Math.abs(difference) / costPrice * 100),
            type: difference > 0 ? "profit" :
                  difference < 0 ? "loss" : "no profit no loss"
        };
    }

    function discount(markedPrice, discountPercent) {
        if (markedPrice < 0 || discountPercent < 0 || discountPercent > 100) {
            throw new Error("Invalid discount");
        }

        const amount = percentageOf(discountPercent, markedPrice);

        return {
            discount: amount,
            finalPrice: checked(markedPrice - amount)
        };
    }

    // -------------------------------------------------------
    // 12. SIMPLE / COMPOUND INTEREST
    // -------------------------------------------------------

    function simpleInterest(principal, rate, years) {
        requirePositive(principal, "Principal");

        if (rate < 0 || years < 0) {
            throw new Error("Rate and time cannot be negative");
        }

        const interest = checked(principal * rate * years / 100);

        return {
            interest: interest,
            total: checked(principal + interest)
        };
    }

    function compoundInterest(principal, rate, years, frequency) {
        requirePositive(principal, "Principal");

        frequency = frequency || 1;

        if (rate < 0 || years < 0 || frequency <= 0) {
            throw new Error("Invalid compound interest values");
        }

        const total = checked(
            principal * Math.pow(
                1 + rate / (100 * frequency),
                frequency * years
            )
        );

        return {
            interest: checked(total - principal),
            total: total
        };
    }

    // -------------------------------------------------------
    // 13. TIME / SPEED / DISTANCE
    // -------------------------------------------------------

    function speedDistanceTime(distance, time) {
        if (distance < 0 || time <= 0) {
            throw new Error("Invalid distance or time");
        }

        return checked(distance / time);
    }

    function distanceFromSpeed(speed, time) {
        if (speed < 0 || time < 0) {
            throw new Error("Invalid speed or time");
        }

        return checked(speed * time);
    }

    function timeFromDistance(distance, speed) {
        if (distance < 0 || speed <= 0) {
            throw new Error("Invalid distance or speed");
        }

        return checked(distance / speed);
    }

    // -------------------------------------------------------
    // 14. TRAIN PROBLEMS
    // -------------------------------------------------------

    function trainCrossPole(trainLength, speed) {
        requirePositive(trainLength, "Train length");
        requirePositive(speed, "Speed");

        // speed is assumed to be km/h
        const speedMps = speed * 1000 / 3600;

        return checked(trainLength / speedMps);
    }

    function trainCrossPlatform(trainLength, platformLength, speed) {
        requirePositive(trainLength, "Train length");
        requirePositive(platformLength, "Platform length");
        requirePositive(speed, "Speed");

        const speedMps = speed * 1000 / 3600;

        return checked(
            (trainLength + platformLength) / speedMps
        );
    }

    function twoTrainsCross(lengthA, lengthB, speedA, speedB, opposite) {
        requirePositive(lengthA, "Train A length");
        requirePositive(lengthB, "Train B length");
        requirePositive(speedA, "Train A speed");
        requirePositive(speedB, "Train B speed");

        // Speeds are assumed to be km/h.
        const relativeSpeed = opposite
            ? speedA + speedB
            : Math.abs(speedA - speedB);

        if (relativeSpeed === 0) {
            throw new Error("Relative speed is zero");
        }

        const metresPerSecond = relativeSpeed * 1000 / 3600;

        return checked(
            (lengthA + lengthB) / metresPerSecond
        );
    }

    // -------------------------------------------------------
    // 15. WORK / TIME / PIPES
    // -------------------------------------------------------

    function combinedWorkTime(times) {
        if (!Array.isArray(times) || !times.length) {
            throw new Error("Work times required");
        }

        let rate = 0;

        for (const time of times) {
            requirePositive(time, "Work time");
            rate += 1 / time;
        }

        return checked(1 / rate);
    }

    function pipeTime(inletTimes, outletTimes) {
        let rate = 0;

        for (const time of inletTimes || []) {
            requirePositive(time, "Inlet time");
            rate += 1 / time;
        }

        for (const time of outletTimes || []) {
            requirePositive(time, "Outlet time");
            rate -= 1 / time;
        }

        if (rate <= 0) {
            throw new Error("Tank cannot be filled at this rate");
        }

        return checked(1 / rate);
    }

    // -------------------------------------------------------
    // 16. AVERAGE
    // -------------------------------------------------------

    function average(numbers) {
        if (!Array.isArray(numbers) || !numbers.length) {
            throw new Error("Numbers required");
        }

        let sum = 0;

        for (const n of numbers) {
            if (!Number.isFinite(n)) {
                throw new Error("Invalid number");
            }

            sum += n;
        }

        return checked(sum / numbers.length);
    }

    // -------------------------------------------------------
    // 17. PERMUTATION / COMBINATION
    // -------------------------------------------------------

    function permutation(n, r) {
        if (
            !Number.isInteger(n) ||
            !Number.isInteger(r) ||
            n < 0 || r < 0 || r > n ||
            n > 170
        ) {
            throw new Error("Invalid n or r");
        }

        let result = 1;

        for (let i = 0; i < r; i++) {
            result *= n - i;
            checked(result);
        }

        return result;
    }

    function combination(n, r) {
        if (
            !Number.isInteger(n) ||
            !Number.isInteger(r) ||
            n < 0 || r < 0 || r > n
        ) {
            throw new Error("Invalid n or r");
        }

        r = Math.min(r, n - r);

        let result = 1;

        for (let i = 1; i <= r; i++) {
            result = result * (n - r + i) / i;
            checked(result);
        }

        return cleanNumber(result);
    }

    // PART 2 END
    // PART 3 WILL BE ADDED BELOW


/* =========================================================
   POWNIN ADVANCED MATH ENGINE v3.0
   PART 3/3 — ALGEBRA + GEOMETRY + ADVANCED SOLVERS
   ========================================================= */

    // -------------------------------------------------------
    // 18. ALGEBRA — LINEAR EQUATION
    // -------------------------------------------------------

    function solveLinear(a, b, c) {
        // ax + b = c

        if (![a, b, c].every(Number.isFinite)) {
            throw new Error("Invalid equation");
        }

        if (a === 0) {
            throw new Error(
                b === c ? "Infinite solutions" : "No solution"
            );
        }

        const x = cleanNumber((c - b) / a);

        return {
            variable: "x",
            answer: x,
            steps: [
                "Given: " + a + "x + " + b + " = " + c,
                "Move constant to the right side.",
                a + "x = " + (c - b),
                "Divide both sides by " + a + ".",
                "x = " + x
            ]
        };
    }

    // -------------------------------------------------------
    // 19. QUADRATIC EQUATION
    // -------------------------------------------------------

    function solveQuadratic(a, b, c) {
        if (![a, b, c].every(Number.isFinite) || a === 0) {
            throw new Error("Invalid quadratic equation");
        }

        const discriminant = b * b - 4 * a * c;

        if (discriminant < 0) {
            return {
                discriminant: cleanNumber(discriminant),
                realRoots: false,
                answer: null,
                message: "No real roots"
            };
        }

        const root = Math.sqrt(discriminant);

        const x1 = cleanNumber((-b + root) / (2 * a));
        const x2 = cleanNumber((-b - root) / (2 * a));

        return {
            discriminant: cleanNumber(discriminant),
            realRoots: true,
            answer: [x1, x2],
            steps: [
                "Given: " + a + "x² + " + b + "x + " + c + " = 0",
                "Discriminant = b² - 4ac",
                "Discriminant = " + cleanNumber(discriminant),
                "Apply the quadratic formula.",
                "x = " + x1 + " or x = " + x2
            ]
        };
    }

    // -------------------------------------------------------
    // 20. GEOMETRY / MENSURATION
    // -------------------------------------------------------

    const geometry = Object.freeze({

        rectangleArea: function (length, width) {
            return checked(length * width);
        },

        rectanglePerimeter: function (length, width) {
            return checked(2 * (length + width));
        },

        squareArea: function (side) {
            return checked(side * side);
        },

        squarePerimeter: function (side) {
            return checked(4 * side);
        },

        triangleArea: function (base, height) {
            return checked(base * height / 2);
        },

        circleArea: function (radius) {
            requirePositive(radius, "Radius");
            return checked(Math.PI * radius * radius);
        },

        circleCircumference: function (radius) {
            requirePositive(radius, "Radius");
            return checked(2 * Math.PI * radius);
        },

        cylinderVolume: function (radius, height) {
            requirePositive(radius, "Radius");
            requirePositive(height, "Height");
            return checked(Math.PI * radius * radius * height);
        },

        sphereVolume: function (radius) {
            requirePositive(radius, "Radius");
            return checked(4 * Math.PI * Math.pow(radius, 3) / 3);
        },

        cubeVolume: function (side) {
            requirePositive(side, "Side");
            return checked(Math.pow(side, 3));
        },

        cuboidVolume: function (length, width, height) {
            return checked(length * width * height);
        },

        coneVolume: function (radius, height) {
            requirePositive(radius, "Radius");
            requirePositive(height, "Height");
            return checked(Math.PI * radius * radius * height / 3);
        },

        pythagoras: function (a, b) {
            requirePositive(a, "Side A");
            requirePositive(b, "Side B");

            return cleanNumber(Math.sqrt(a * a + b * b));
        },

        heronArea: function (a, b, c) {
            requirePositive(a, "Side A");
            requirePositive(b, "Side B");
            requirePositive(c, "Side C");

            if (a + b <= c || a + c <= b || b + c <= a) {
                throw new Error("Invalid triangle sides");
            }

            const s = (a + b + c) / 2;

            return cleanNumber(
                Math.sqrt(s * (s - a) * (s - b) * (s - c))
            );
        }
    });

    // -------------------------------------------------------
    // 21. STATISTICS
    // -------------------------------------------------------

    function median(numbers) {
        if (!numbers.length) {
            throw new Error("Numbers required");
        }

        const sorted = numbers.slice().sort(function (a, b) {
            return a - b;
        });

        const middle = Math.floor(sorted.length / 2);

        return sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    function mode(numbers) {
        if (!numbers.length) {
            throw new Error("Numbers required");
        }

        const counts = new Map();

        for (const n of numbers) {
            counts.set(n, (counts.get(n) || 0) + 1);
        }

        const highest = Math.max.apply(null, Array.from(counts.values()));

        if (highest === 1) return [];

        return Array.from(counts.entries())
            .filter(function (item) {
                return item[1] === highest;
            })
            .map(function (item) {
                return item[0];
            });
    }

    function variance(numbers) {
        const mean = average(numbers);

        return cleanNumber(
            numbers.reduce(function (sum, n) {
                return sum + Math.pow(n - mean, 2);
            }, 0) / numbers.length
        );
    }

    function standardDeviation(numbers) {
        return cleanNumber(Math.sqrt(variance(numbers)));
    }

    // -------------------------------------------------------
    // 22. PROBABILITY
    // -------------------------------------------------------

    function probability(favourable, total) {
        if (
            total <= 0 ||
            favourable < 0 ||
            favourable > total
        ) {
            throw new Error("Invalid probability values");
        }

        return {
            probability: cleanNumber(favourable / total),
            percentage: cleanNumber(favourable / total * 100)
        };
    }

    function conditionalProbability(joint, condition) {
        if (condition <= 0) {
            throw new Error("Condition probability must be positive");
        }

        if (joint < 0 || joint > condition) {
            throw new Error("Invalid probability values");
        }

        return cleanNumber(joint / condition);
    }

    // -------------------------------------------------------
    // 23. MATRIX / DETERMINANT
    // -------------------------------------------------------

    function determinant(matrix) {
        if (!Array.isArray(matrix) || !matrix.length) {
            throw new Error("Matrix required");
        }

        const n = matrix.length;

        if (!matrix.every(function (row) {
            return Array.isArray(row) &&
                row.length === n &&
                row.every(Number.isFinite);
        })) {
            throw new Error("Matrix must be square");
        }

        const a = matrix.map(function (row) {
            return row.slice();
        });

        let det = 1;

        for (let i = 0; i < n; i++) {
            let pivot = i;

            for (let j = i + 1; j < n; j++) {
                if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) {
                    pivot = j;
                }
            }

            if (Math.abs(a[pivot][i]) < EPSILON) {
                return 0;
            }

            if (pivot !== i) {
                const temp = a[i];
                a[i] = a[pivot];
                a[pivot] = temp;
                det *= -1;
            }

            const value = a[i][i];
            det *= value;

            for (let j = i + 1; j < n; j++) {
                const factor = a[j][i] / value;

                for (let k = i + 1; k < n; k++) {
                    a[j][k] -= factor * a[i][k];
                }
            }
        }

        return cleanNumber(det);
    }

    // -------------------------------------------------------
    // 24. NUMERICAL CALCULUS
    // -------------------------------------------------------

    function evaluateAt(expression, x) {
        const replaced = expression.replace(
            /\bx\b/g,
            "(" + String(x) + ")"
        );

        return parseExpression(tokenize(normalizeText(replaced)));
    }

    function derivative(expression, x, h) {
        h = h || 0.00001;

        requirePositive(h, "Step size");

        const left = evaluateAt(expression, x - h);
        const right = evaluateAt(expression, x + h);

        return cleanNumber((right - left) / (2 * h));
    }

    function numericalIntegral(expression, a, b, intervals) {
        intervals = intervals || 1000;

        if (
            !Number.isInteger(intervals) ||
            intervals < 2 ||
            intervals > 100000 ||
            !Number.isFinite(a) ||
            !Number.isFinite(b)
        ) {
            throw new Error("Invalid integration values");
        }

        if (intervals % 2 !== 0) intervals++;

        const h = (b - a) / intervals;

        let sum =
            evaluateAt(expression, a) +
            evaluateAt(expression, b);

        for (let i = 1; i < intervals; i++) {
            const y = evaluateAt(expression, a + i * h);

            sum += (i % 2 === 0 ? 2 : 4) * y;
        }

        return cleanNumber(sum * h / 3);
    }

    // -------------------------------------------------------
    // 25. LIMIT — NUMERICAL APPROXIMATION
    // -------------------------------------------------------

    function numericalLimit(expression, x, h) {
        h = h || 0.000001;

        requirePositive(h, "Limit step");

        const left = evaluateAt(expression, x - h);
        const right = evaluateAt(expression, x + h);

        if (
            Math.abs(left - right) >
            Math.max(0.001, Math.abs(left) * 0.001)
        ) {
            return {
                exists: false,
                left: cleanNumber(left),
                right: cleanNumber(right)
            };
        }

        return {
            exists: true,
            answer: cleanNumber((left + right) / 2),
            approximate: true
        };
    }

    // -------------------------------------------------------
    // 26. UNIT CONVERSION
    // -------------------------------------------------------

    const unitFactors = Object.freeze({
        mm: 0.001,
        cm: 0.01,
        m: 1,
        km: 1000,
        inch: 0.0254,
        ft: 0.3048,
        mile: 1609.344,

        mg: 0.000001,
        g: 0.001,
        kg: 1,
        tonne: 1000,

        second: 1,
        minute: 60,
        hour: 3600,
        day: 86400
    });

    function convertUnit(value, from, to) {
        from = String(from).toLowerCase();
        to = String(to).toLowerCase();

        if (
            !Object.prototype.hasOwnProperty.call(unitFactors, from) ||
            !Object.prototype.hasOwnProperty.call(unitFactors, to)
        ) {
            throw new Error("Unsupported or incompatible unit");
        }

        return cleanNumber(
            value * unitFactors[from] / unitFactors[to]
        );
    }

    function convertTemperature(value, from, to) {
        from = String(from).toLowerCase();
        to = String(to).toLowerCase();

        let celsius;

        if (from === "c" || from === "celsius") {
            celsius = value;
        } else if (from === "f" || from === "fahrenheit") {
            celsius = (value - 32) * 5 / 9;
        } else if (from === "k" || from === "kelvin") {
            celsius = value - 273.15;
        } else {
            throw new Error("Unknown temperature unit");
        }

        if (to === "c" || to === "celsius") return cleanNumber(celsius);
        if (to === "f" || to === "fahrenheit") {
            return cleanNumber(celsius * 9 / 5 + 32);
        }
        if (to === "k" || to === "kelvin") {
            return cleanNumber(celsius + 273.15);
        }

        throw new Error("Unknown temperature unit");
    }

    // -------------------------------------------------------
    // 27. WORD PROBLEM SOLVER
    // -------------------------------------------------------

    function resultObject(topic, answer, steps, extra) {
        return Object.assign({
            success: true,
            topic: topic,
            answer: answer,
            steps: steps || []
        }, extra || {});
    }

    function solveWordProblem(input) {
        const text = normalizeDigits(String(input))
            .toLowerCase()
            .replace(/,/g, "")
            .trim();

        let match;

        // LCM
        match = text.match(
            /(?:lcm|least common multiple)\s+(?:of\s+)?(-?\d+)\s+(?:and|,)\s+(-?\d+)/i
        );

        if (match) {
            const answer = solveLCM(Number(match[1]), Number(match[2]));

            return resultObject("LCM", answer, [
                "Find the multiples of both numbers.",
                "The smallest common multiple is " + answer + "."
            ]);
        }

        // HCF / GCD
        match = text.match(
            /(?:hcf|gcd|gcf|greatest common divisor|highest common factor)\s+(?:of\s+)?(-?\d+)\s+(?:and|,)\s+(-?\d+)/i
        );

        if (match) {
            const answer = solveHCF(Number(match[1]), Number(match[2]));

            return resultObject("HCF", answer, [
                "Apply the Euclidean algorithm.",
                "The highest common factor is " + answer + "."
            ]);
        }

        // Percentage of a number
        match = text.match(
            /(-?\d+(?:\.\d+)?)\s*%\s*(?:of|এর|का)\s*(-?\d+(?:\.\d+)?)/i
        );

        if (match) {
            const p = Number(match[1]);
            const n = Number(match[2]);
            const answer = percentageOf(p, n);

            return resultObject("Percentage", answer, [
                p + "% means " + p + "/100.",
                "(" + p + " / 100) × " + n + " = " + answer
            ]);
        }

        // Speed = distance / time
        match = text.match(
            /(?:speed|গতি|चाल)\s*(?:is|=|হলো|है)?\s*(-?\d+(?:\.\d+)?)\s*(?:km\/h|kmph)\b/i
        );

        if (match) {
            return resultObject(
                "Speed",
                Number(match[1]),
                ["Speed value identified: " + match[1] + " km/h."],
                { unit: "km/h" }
            );
        }

        // Distance from speed and time
        match = text.match(
            /(?:distance|দূরত্ব|दूरी).*?(-?\d+(?:\.\d+)?)\s*(?:km\/h|kmph).*?(-?\d+(?:\.\d+)?)\s*(hours?|hrs?|ঘণ্টা|घंटे?)/i
        );

        if (match) {
            const speed = Number(match[1]);
            const time = Number(match[2]);
            const answer = distanceFromSpeed(speed, time);

            return resultObject("Distance", answer, [
                "Distance = Speed × Time.",
                speed + " × " + time + " = " + answer + " km."
            ], { unit: "km" });
        }

        // Direct arithmetic expression
        try {
            const cleaned = normalizeText(text)
                .replace(/^(calculate|compute|what is|solve)\s+/i, "")
                .replace(/[?=]/g, "")
                .trim();

            if (
                cleaned &&
                /^[0-9eE+\-*/%^().,\s]+$/.test(cleaned)
            ) {
                const answer = parseExpression(tokenize(cleaned));

                return resultObject("Arithmetic", cleanNumber(answer), [
                    "Evaluate the expression using mathematical operator precedence.",
                    "Answer = " + cleanNumber(answer)
                ]);
            }
        } catch (error) {
            // Try the next solver or return unsupported.
        }

        return null;
    }

    // -------------------------------------------------------
    // 28. MAIN SOLVER
    // -------------------------------------------------------

    function solve(input) {
        try {
            if (typeof input !== "string" || !input.trim()) {
                return null;
            }

            if (input.length > MAX_LENGTH) {
                return null;
            }

            const text = normalizeText(input);

            // Linear equation: solve 2x + 5 = 15
            let match = text.match(
                /^solve\s+([+-]?\d*\.?\d*)\s*x\s*([+-]\s*\d+(?:\.\d+)?)?\s*=\s*([+-]?\d+(?:\.\d+)?)$/i
            );

            if (match) {
                let a = match[1];

                if (a === "" || a === "+") a = 1;
                if (a === "-") a = -1;

                const b = match[2]
                    ? Number(match[2].replace(/\s/g, ""))
                    : 0;

                const c = Number(match[3]);

                const result = solveLinear(Number(a), b, c);

                return resultObject(
                    "Linear Algebra",
                    result.answer,
                    result.steps,
                    { variable: "x" }
                );
            }

            // Quadratic equation in form ax^2 + bx + c = 0
            match = text.match(
                /^solve\s+([+-]?\d*\.?\d*)\s*x\^2\s*([+-]\s*\d*\.?\d*)\s*x\s*([+-]\s*\d+(?:\.\d+)?)?\s*=\s*0$/i
            );

            if (match) {
                let a = match[1];
                let b = match[2];

                if (a === "" || a === "+") a = 1;
                if (a === "-") a = -1;
                if (b === "" || b === "+") b = 1;
                if (b === "-") b = -1;

                const c = match[3] ? Number(match[3]) : 0;

                const result = solveQuadratic(
                    Number(a),
                    Number(b),
                    c
                );

                return resultObject(
                    "Quadratic Algebra",
                    result.answer,
                    result.steps,
                    { discriminant: result.discriminant }
                );
            }

            // Word problems
            const wordResult = solveWordProblem(input);

            if (wordResult) return wordResult;

            // Plain expression
            const cleaned = text
                .replace(/^(calculate|compute|what is)\s+/i, "")
                .replace(/[?=]/g, "")
                .trim();

            if (
                cleaned &&
                /^[0-9eE+\-*/%^().,\s]+$/.test(cleaned)
            ) {
                const answer = parseExpression(tokenize(cleaned));

                return resultObject("Arithmetic", cleanNumber(answer), [
                    "Apply BODMAS/operator precedence.",
                    "Answer = " + cleanNumber(answer)
                ]);
            }

            return null;

        } catch (error) {
            return {
                success: false,
                error: error.message || "Unable to solve this problem"
            };
        }
    }

    // -------------------------------------------------------
    // 29. SAFE PUBLIC API
    // -------------------------------------------------------

    function calculate(input) {
        try {
            if (typeof input !== "string" || !input.trim()) {
                return null;
            }

            if (input.length > MAX_LENGTH) return null;

            const expression = normalizeText(input)
                .replace(/^(calculate|compute|what is|solve)\s+/i, "")
                .replace(/[?=]/g, "")
                .trim();

            if (!expression) return null;

            if (!/^[0-9eE+\-*/%^().,!a-z,\s]+$/i.test(expression)) {
                return null;
            }

            const tokens = tokenize(expression);

            if (!tokens.length) return null;

            return cleanNumber(parseExpression(tokens));

        } catch (error) {
            return null;
        }
    }

    window.PowninMath = Object.freeze({

        version: VERSION,

        calculate: calculate,

        solve: solve,

        gcd: gcd,
        lcm: lcm,

        fraction: fraction,
        fractionOperation: fractionOperation,

        percentage: percentage,
        percentageOf: percentageOf,
        percentageChange: percentageChange,

        simplifyRatio: simplifyRatio,
        divideInRatio: divideInRatio,

        profitLoss: profitLoss,
        discount: discount,

        simpleInterest: simpleInterest,
        compoundInterest: compoundInterest,

        speedDistanceTime: speedDistanceTime,
        distanceFromSpeed: distanceFromSpeed,
        timeFromDistance: timeFromDistance,

        trainCrossPole: trainCrossPole,
        trainCrossPlatform: trainCrossPlatform,
        twoTrainsCross: twoTrainsCross,

        combinedWorkTime: combinedWorkTime,
        pipeTime: pipeTime,

        average: average,
        median: median,
        mode: mode,
        variance: variance,
        standardDeviation: standardDeviation,

        permutation: permutation,
        combination: combination,

        solveLinear: solveLinear,
        solveQuadratic: solveQuadratic,

        geometry: geometry,

        probability: probability,
        conditionalProbability: conditionalProbability,

        determinant: determinant,

        derivative: derivative,
        numericalIntegral: numericalIntegral,
        numericalLimit: numericalLimit,

        convertUnit: convertUnit,
        convertTemperature: convertTemperature

    });

    console.log("POWNIN ADVANCED MATH ENGINE v" + VERSION + " LOADED");

})();
