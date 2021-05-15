export default {
  invalid: [
    {
      code: `
      /**
       *
       **
       */
      `,
      errors: [{
        line: 4,
        message: 'Should be no multiple asterisks on middle lines.',
      }],
      output: `
      /**
       *
       *
       */
      `,
    },
    {
      code: `
      /**
       *
       **
       */
      `,
      errors: [{
        line: 4,
        message: 'Should be no multiple asterisks on middle lines.',
      }],
      options: [{
        preventAtMiddleLines: true,
      }],
      output: `
      /**
       *
       *
       */
      `,
    },
    {
      code: `
      /**
       *
       **
       */
      `,
      errors: [{
        line: 4,
        message: 'Should be no multiple asterisks on middle lines.',
      }],
      options: [{
        preventAtEnd: false,
      }],
      output: `
      /**
       *
       *
       */
      `,
    },
    {
      code: `
      /**
       * With a description
       * @tag {SomeType} and a tag with details
       **
       */
      `,
      errors: [{
        line: 5,
        message: 'Should be no multiple asterisks on middle lines.',
      }],
      output: `
      /**
       * With a description
       * @tag {SomeType} and a tag with details
       *
       */
      `,
    },
    {
      code: `
      /**
       **
       *
       */
      `,
      errors: [{
        line: 3,
        message: 'Should be no multiple asterisks on middle lines.',
      }],
      output: `
      /**
       *
       *
       */
      `,
    },
    {
      code: `
      /**
       * Desc.
       *
       **/
      `,
      errors: [{
        line: 5,
        message: 'Should be no multiple asterisks on end lines.',
      }],
      output: `
      /**
       * Desc.
       *
       */
      `,
    },
    {
      code: `
      /**
       * Desc.
       *
       **/
      `,
      errors: [{
        line: 5,
        message: 'Should be no multiple asterisks on end lines.',
      }],
      options: [{
        preventAtEnd: true,
      }],
      output: `
      /**
       * Desc.
       *
       */
      `,
    },
    {
      code: `
      /**
       * Desc.
       *
       abc * **/
      `,
      errors: [{
        line: 5,
        message: 'Should be no multiple asterisks on end lines.',
      }],
      options: [{
        preventAtEnd: true,
      }],
      output: `
      /**
       * Desc.
       *
       abc*/
      `,
    },
    {
      code: `
      /**
       * Desc.
       *
       **/
      `,
      errors: [{
        line: 5,
        message: 'Should be no multiple asterisks on end lines.',
      }],
      options: [{
        preventAtMiddleLines: false,
      }],
      output: `
      /**
       * Desc.
       *
       */
      `,
    },
    {
      code: `
      /** Desc. **/
      `,
      errors: [{
        line: 2,
        message: 'Should be no multiple asterisks on end lines.',
      }],
      output: `
      /** Desc. */
      `,
    },
    {
      code: `
      /** @someTag name desc. **/
      `,
      errors: [{
        line: 2,
        message: 'Should be no multiple asterisks on end lines.',
      }],
      output: `
      /** @someTag name desc. */
      `,
    },
    {
      code: `
      /** abc * */
      `,
      errors: [{
        line: 2,
        message: 'Should be no multiple asterisks on end lines.',
      }],
      output: `
      /** abc */
      `,
    },
  ],
  valid: [
    {
      code: `
      /**
       *
       * Desc. ***
       */
      `,
    },
    {
      code: `
      /**
       * Desc. ***
       *
       */
      `,
    },
    {
      code: `
      /**
       * Desc.
       *
       * sth */
      `,
    },
    {
      code: `
      /**
       **
       *
       */
      `,
      options: [{
        preventAtMiddleLines: false,
      }],
    },
    {
      code: `
      /**
       *
       *
       **/
      `,
      options: [{
        preventAtEnd: false,
      }],
    },
    {
      code: `
      /**
       * With a desc.
       * and ***
       */
      `,
    },
    {
      code: `
      /**
       * and ***
       * With a desc.
       */
      `,
    },
    {
      code: `
      /**
       * With a desc.
       * With a desc.
       * Desc. */
      `,
    },
    {
      code: `
      /**
       * With a description
       * @tag {SomeType} and a tag with details
       *
       */
      `,
    },
    {
      code: `
      /** abc */
      function foo() {
          //
      }
      `,
    },
    {
      code: `
      /** foo */
      function foo(): void {
          //
      }
      `,
      parser: require.resolve('@typescript-eslint/parser'),
    },
    {
      code: `
      /** @aTag abc */
      function foo() {
          //
      }
      `,
    },
  ],
};
