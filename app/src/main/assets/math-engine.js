
/* =====================================================
   POWNIN LIGHT v2.0
   MEDIUM MATH ENGINE
   PART 1/2
   ===================================================== */

(function () {
    "use strict";

    const MAX_LENGTH = 200;
    const MAX_TOKENS = 100;
    const MAX_RESULT = 1e15;

    // Bengali and Hindi digits to English digits
    function normalizeDigits(text) {
        const bengali = "০১২৩৪৫৬৭৮৯";
        const hindi = "०१२३४५६७८९";

        return String(text).replace(/[০-৯०-९]/g, function (digit) {
            let index = bengali.indexOf(digit);

            if (index !== -1) return String(index);

            index = hindi.indexOf(digit);

            return index !== -1 ? String(index) : digit;
        });
    }

    // Normalize spoken operators
    function normalizeExpression(text) {
        let value = normalizeDigits(text)
            .toLowerCase()
            .trim();

        const replacements = [
            [/\bplus\b/g, "+"],
            [/\badded to\b/g, "+"],
            [/\bminus\b/g, "-"],
            [/\bsubtract\b/g, "-"],
            [/\btimes\b/g, "*"],
            [/\bmultiplied by\b/g, "*"],
            [/\bdivided by\b/g, "/"],
            [/\bover\b/g, "/"],
            [/\bmodulo\b/g, "%"],
            [/\bmod\b/g, "%"],
            [/যোগ/g, "+"],
            [/বিয়োগ/g, "-"],
            [/গুণ/g, "*"],
            [/ভাগ/g, "/"],
            [/जोड़/g, "+"],
            [/घटाव/g, "-"],
            [/गुणा/g, "*"],
            [/भाग/g, "/"]
        ];

        for (const [pattern, replacement] of replacements) {
            value = value.replace(pattern, replacement);
        }

        value = value
            .replace(/^(calculate|compute|what is|solve)\s+/i, "")
            .replace(/^(হিসাব কর|গণনা কর|কত হয়)\s*/, "")
            .replace(/^(गणना करो|कितना है)\s*/, "");

        return value.trim();
    }

    // Tokenizer
    function tokenize(expression) {
        const tokens = [];
        let position = 0;

        while (position < expression.length) {
            const remaining = expression.slice(position);

            if (/^\s+/.test(remaining)) {
                position += remaining.match(/^\s+/)[0].length;
                continue;
            }

            const number = remaining.match(
                /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i
            );

            if (number) {
                tokens.push({
                    type: "number",
                    value: Number(number[0])
                });

                position += number[0].length;
            } else {
                const operator = remaining[0];

                if ("+-*/%^()".includes(operator)) {
                    tokens.push({
                        type: "operator",
                        value: operator
                    });

                    position++;
                } else {
                    throw new Error("Invalid character");
                }
            }

            if (tokens.length > MAX_TOKENS) {
                throw new Error("Too many tokens");
            }
        }

        return tokens;
    }

// PART 1 END

 
// =====================================================
// POWNIN LIGHT v2.0
// MEDIUM MATH ENGINE
// PART 2/2
// =====================================================

    function parseTokens(tokens) {
        let index = 0;

        function peek() {
            return tokens[index];
        }

        function consume(value) {
            if (peek() && peek().value === value) {
                index++;
                return true;
            }

            return false;
        }

        function checked(value) {
            if (
                !Number.isFinite(value) ||
                Math.abs(value) > MAX_RESULT
            ) {
                throw new Error("Result out of range");
            }

            return value;
        }

        function primary() {
            if (consume("(")) {
                const value = expression();

                if (!consume(")")) {
                    throw new Error("Missing closing bracket");
                }

                return value;
            }

            const token = peek();

            if (!token || token.type !== "number") {
                throw new Error("Number expected");
            }

            index++;
            return checked(token.value);
        }

        function unary() {
            if (consume("+")) return unary();
            if (consume("-")) return -unary();

            return primary();
        }

        function power() {
            let value = unary();

            if (consume("^")) {
                const exponent = power();
                value = checked(Math.pow(value, exponent));
            }

            return value;
        }

        function term() {
            let value = power();

            while (peek() && ["*", "/", "%"].includes(peek().value)) {
                const operator = peek().value;
                index++;

                const right = power();

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
            }

            return value;
        }

        function expression() {
            let value = term();

            while (
                peek() &&
                (peek().value === "+" || peek().value === "-")
            ) {
                const operator = peek().value;
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
            throw new Error("Unexpected token");
        }

        return checked(result);
    }

    function calculate(input) {
        try {
            const expression = normalizeExpression(input);

            if (
                !expression ||
                expression.length > MAX_LENGTH
            ) {
                return null;
            }

            if (!/^[0-9eE+\-*/%^().\s]+$/.test(expression)) {
                return null;
            }

            const tokens = tokenize(expression);

            if (!tokens.length) return null;

            const result = parseTokens(tokens);

            return Number.isInteger(result)
                ? result
                : Number(result.toFixed(10));

        } catch (error) {
            return null;
        }
    }

    window.PowninMath = Object.freeze({
        calculate: calculate,
        version: "2.0"
    });

    console.log("PowNin Math Engine Loaded: 2.0");

})();
