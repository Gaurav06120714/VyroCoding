import { pool } from './client.js';
import dotenv from 'dotenv';

dotenv.config();

const problems = [
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.`,
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
      { input: 'nums = [3,3], target = 6', output: '[0,1]' },
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.',
    ],
    tags: ['array', 'hash-table'],
    starterCode: {
      93: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {

}

const [a, b] = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n')[0]);
console.log(JSON.stringify(twoSum(a, b)));`,
      71: `def two_sum(nums, target):
    pass

import sys, json
data = json.loads(sys.stdin.readline())
print(json.dumps(two_sum(data[0], data[1])))`,
      54: `#include <bits/stdc++.h>
using namespace std;
vector<int> twoSum(vector<int>& nums, int target) {

}
int main() { return 0; }`,
    },
    testCases: [
      { input: '[[2,7,11,15],9]', expectedOutput: '[0,1]' },
      { input: '[[3,2,4],6]',     expectedOutput: '[1,2]' },
      { input: '[[3,3],6]',       expectedOutput: '[0,1]' },
    ],
    acceptanceRate: 49.5,
  },
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'easy',
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    examples: [
      { input: 's = "()"',   output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"',   output: 'false' },
    ],
    constraints: [
      '1 <= s.length <= 10^4',
      "s consists of parentheses only '()[]{}'.",
    ],
    tags: ['string', 'stack'],
    starterCode: {
      93: `function isValid(s) {

}

const s = require('fs').readFileSync('/dev/stdin','utf8').trim();
console.log(isValid(s));`,
      71: `def is_valid(s):
    pass

import sys
print(str(is_valid(sys.stdin.readline().strip())).lower())`,
      54: `#include <bits/stdc++.h>
using namespace std;
bool isValid(string s) {

}
int main() { return 0; }`,
    },
    testCases: [
      { input: '()',     expectedOutput: 'true' },
      { input: '()[]{}', expectedOutput: 'true' },
      { input: '(]',     expectedOutput: 'false' },
      { input: '([)]',   expectedOutput: 'false' },
      { input: '{[]}',   expectedOutput: 'true' },
    ],
    acceptanceRate: 40.6,
  },
  {
    slug: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    difficulty: 'easy',
    description: `You are given the heads of two sorted linked lists \`list1\` and \`list2\`.

Merge the two lists into one **sorted** list. The list should be made by splicing together the nodes of the first two lists.

Return the head of the merged linked list.`,
    examples: [
      { input: 'list1 = [1,2,4], list2 = [1,3,4]', output: '[1,1,2,3,4,4]' },
      { input: 'list1 = [], list2 = []', output: '[]' },
      { input: 'list1 = [], list2 = [0]', output: '[0]' },
    ],
    constraints: [
      'The number of nodes in both lists is in the range [0, 50].',
      '-100 <= Node.val <= 100',
      'Both list1 and list2 are sorted in non-decreasing order.',
    ],
    tags: ['linked-list', 'recursion'],
    starterCode: {
      93: `function mergeTwoLists(list1, list2) {

}`,
      71: `def merge_two_lists(list1, list2):
    pass`,
      54: `struct ListNode { int val; ListNode* next; };
ListNode* mergeTwoLists(ListNode* l1, ListNode* l2) {

}`,
    },
    testCases: [
      { input: '[[1,2,4],[1,3,4]]', expectedOutput: '[1,1,2,3,4,4]' },
      { input: '[[],[]]',           expectedOutput: '[]' },
      { input: '[[],[0]]',          expectedOutput: '[0]' },
    ],
    acceptanceRate: 62.1,
  },
  {
    slug: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'medium',
    description: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.`,
    examples: [
      { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'The subarray [4,-1,2,1] has the largest sum 6.' },
      { input: 'nums = [1]', output: '1' },
      { input: 'nums = [5,4,-1,7,8]', output: '23' },
    ],
    constraints: [
      '1 <= nums.length <= 10^5',
      '-10^4 <= nums[i] <= 10^4',
    ],
    tags: ['array', 'divide-and-conquer', 'dynamic-programming'],
    starterCode: {
      93: `function maxSubArray(nums) {

}

const nums = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8').trim());
console.log(maxSubArray(nums));`,
      71: `def max_sub_array(nums):
    pass

import sys, json
print(max_sub_array(json.loads(sys.stdin.readline())))`,
      54: `#include <bits/stdc++.h>
using namespace std;
int maxSubArray(vector<int>& nums) {

}
int main() { return 0; }`,
    },
    testCases: [
      { input: '[-2,1,-3,4,-1,2,1,-5,4]', expectedOutput: '6' },
      { input: '[1]',                      expectedOutput: '1' },
      { input: '[5,4,-1,7,8]',             expectedOutput: '23' },
    ],
    acceptanceRate: 49.8,
  },
  {
    slug: 'longest-substring-without-repeating',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'medium',
    description: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.`,
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with the length of 3.' },
      { input: 's = "bbbbb"',   output: '1', explanation: 'The answer is "b", with the length of 1.' },
      { input: 's = "pwwkew"',  output: '3', explanation: 'The answer is "wke", with the length of 3.' },
    ],
    constraints: [
      '0 <= s.length <= 5 * 10^4',
      's consists of English letters, digits, symbols and spaces.',
    ],
    tags: ['hash-table', 'string', 'sliding-window'],
    starterCode: {
      93: `function lengthOfLongestSubstring(s) {

}

const s = require('fs').readFileSync('/dev/stdin','utf8').trim();
console.log(lengthOfLongestSubstring(s));`,
      71: `def length_of_longest_substring(s):
    pass

import sys
print(length_of_longest_substring(sys.stdin.readline().strip()))`,
      54: `#include <bits/stdc++.h>
using namespace std;
int lengthOfLongestSubstring(string s) {

}
int main() { return 0; }`,
    },
    testCases: [
      { input: 'abcabcbb', expectedOutput: '3' },
      { input: 'bbbbb',    expectedOutput: '1' },
      { input: 'pwwkew',   expectedOutput: '3' },
      { input: '',         expectedOutput: '0' },
    ],
    acceptanceRate: 33.8,
  },
  {
    slug: '3sum',
    title: '3Sum',
    difficulty: 'medium',
    description: `Given an integer array \`nums\`, return all the triplets \`[nums[i], nums[j], nums[k]]\` such that \`i != j\`, \`i != k\`, and \`j != k\`, and \`nums[i] + nums[j] + nums[k] == 0\`.

Notice that the solution set must not contain duplicate triplets.`,
    examples: [
      { input: 'nums = [-1,0,1,2,-1,-4]', output: '[[-1,-1,2],[-1,0,1]]' },
      { input: 'nums = [0,1,1]',           output: '[]' },
      { input: 'nums = [0,0,0]',           output: '[[0,0,0]]' },
    ],
    constraints: [
      '3 <= nums.length <= 3000',
      '-10^5 <= nums[i] <= 10^5',
    ],
    tags: ['array', 'two-pointers', 'sorting'],
    starterCode: {
      93: `function threeSum(nums) {

}

const nums = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8').trim());
console.log(JSON.stringify(threeSum(nums)));`,
      71: `def three_sum(nums):
    pass

import sys, json
print(json.dumps(three_sum(json.loads(sys.stdin.readline()))))`,
      54: `#include <bits/stdc++.h>
using namespace std;
vector<vector<int>> threeSum(vector<int>& nums) {

}
int main() { return 0; }`,
    },
    testCases: [
      { input: '[-1,0,1,2,-1,-4]', expectedOutput: '[[-1,-1,2],[-1,0,1]]' },
      { input: '[0,1,1]',           expectedOutput: '[]' },
      { input: '[0,0,0]',           expectedOutput: '[[0,0,0]]' },
    ],
    acceptanceRate: 32.4,
  },
  {
    slug: 'binary-tree-level-order-traversal',
    title: 'Binary Tree Level Order Traversal',
    difficulty: 'medium',
    description: `Given the \`root\` of a binary tree, return the level order traversal of its nodes' values (i.e., from left to right, level by level).`,
    examples: [
      { input: 'root = [3,9,20,null,null,15,7]', output: '[[3],[9,20],[15,7]]' },
      { input: 'root = [1]', output: '[[1]]' },
      { input: 'root = []',  output: '[]' },
    ],
    constraints: [
      'The number of nodes in the tree is in the range [0, 2000].',
      '-1000 <= Node.val <= 1000',
    ],
    tags: ['tree', 'breadth-first-search', 'binary-tree'],
    starterCode: {
      93: `function levelOrder(root) {

}`,
      71: `def level_order(root):
    pass`,
      54: `struct TreeNode { int val; TreeNode* left; TreeNode* right; };
vector<vector<int>> levelOrder(TreeNode* root) {

}`,
    },
    testCases: [
      { input: '[3,9,20,null,null,15,7]', expectedOutput: '[[3],[9,20],[15,7]]' },
      { input: '[1]',                     expectedOutput: '[[1]]' },
      { input: '[]',                      expectedOutput: '[]' },
    ],
    acceptanceRate: 65.2,
  },
  {
    slug: 'word-search',
    title: 'Word Search',
    difficulty: 'medium',
    description: `Given an \`m x n\` grid of characters \`board\` and a string \`word\`, return \`true\` if \`word\` exists in the grid.

The word can be constructed from letters of sequentially adjacent cells, where adjacent cells are horizontally or vertically neighboring. The same letter cell may not be used more than once.`,
    examples: [
      { input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "ABCCED"', output: 'true' },
      { input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "SEE"', output: 'true' },
      { input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "ABCB"', output: 'false' },
    ],
    constraints: [
      'm == board.length',
      'n = board[i].length',
      '1 <= m, n <= 6',
      '1 <= word.length <= 15',
      'board and word consists of only lowercase and uppercase English letters.',
    ],
    tags: ['array', 'backtracking', 'matrix'],
    starterCode: {
      93: `function exist(board, word) {

}`,
      71: `def exist(board, word):
    pass`,
      54: `#include <bits/stdc++.h>
using namespace std;
bool exist(vector<vector<char>>& board, string word) {

}
int main() { return 0; }`,
    },
    testCases: [
      { input: '[["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]]\nABCCED', expectedOutput: 'true' },
      { input: '[["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]]\nSEE',    expectedOutput: 'true' },
      { input: '[["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]]\nABCB',   expectedOutput: 'false' },
    ],
    acceptanceRate: 40.2,
  },
  {
    slug: 'merge-k-sorted-lists',
    title: 'Merge k Sorted Lists',
    difficulty: 'hard',
    description: `You are given an array of \`k\` linked-lists \`lists\`, each linked-list is sorted in ascending order.

Merge all the linked-lists into one sorted linked-list and return it.`,
    examples: [
      { input: 'lists = [[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]' },
      { input: 'lists = []', output: '[]' },
      { input: 'lists = [[]]', output: '[]' },
    ],
    constraints: [
      'k == lists.length',
      '0 <= k <= 10^4',
      '0 <= lists[i].length <= 500',
      '-10^4 <= lists[i][j] <= 10^4',
      'lists[i] is sorted in ascending order.',
      'The sum of lists[i].length will not exceed 10^4.',
    ],
    tags: ['linked-list', 'divide-and-conquer', 'heap', 'merge-sort'],
    starterCode: {
      93: `function mergeKLists(lists) {

}`,
      71: `def merge_k_lists(lists):
    pass`,
      54: `struct ListNode { int val; ListNode* next; };
ListNode* mergeKLists(vector<ListNode*>& lists) {

}`,
    },
    testCases: [
      { input: '[[1,4,5],[1,3,4],[2,6]]', expectedOutput: '[1,1,2,3,4,4,5,6]' },
      { input: '[]',                       expectedOutput: '[]' },
      { input: '[[]]',                     expectedOutput: '[]' },
    ],
    acceptanceRate: 52.4,
  },
  {
    slug: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'hard',
    description: `Given \`n\` non-negative integers representing an elevation map where the width of each bar is \`1\`, compute how much water it can trap after raining.`,
    examples: [
      { input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6', explanation: 'The above elevation map (black section) is represented by array [0,1,0,2,1,0,1,3,2,1,2,1]. In this case, 6 units of rain water (blue section) are being trapped.' },
      { input: 'height = [4,2,0,3,2,5]', output: '9' },
    ],
    constraints: [
      'n == height.length',
      '1 <= n <= 2 * 10^4',
      '0 <= height[i] <= 10^5',
    ],
    tags: ['array', 'two-pointers', 'dynamic-programming', 'stack'],
    starterCode: {
      93: `function trap(height) {

}

const height = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8').trim());
console.log(trap(height));`,
      71: `def trap(height):
    pass

import sys, json
print(trap(json.loads(sys.stdin.readline())))`,
      54: `#include <bits/stdc++.h>
using namespace std;
int trap(vector<int>& height) {

}
int main() { return 0; }`,
    },
    testCases: [
      { input: '[0,1,0,2,1,0,1,3,2,1,2,1]', expectedOutput: '6' },
      { input: '[4,2,0,3,2,5]',              expectedOutput: '9' },
    ],
    acceptanceRate: 60.5,
  },
];

async function seed(): Promise<void> {
  console.log('Seeding problems...');

  for (const problem of problems) {
    await pool.query(
      `INSERT INTO problems (slug, title, difficulty, description, examples, constraints, starter_code, test_cases, tags, acceptance_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         difficulty = EXCLUDED.difficulty,
         description = EXCLUDED.description,
         examples = EXCLUDED.examples,
         constraints = EXCLUDED.constraints,
         starter_code = EXCLUDED.starter_code,
         test_cases = EXCLUDED.test_cases,
         tags = EXCLUDED.tags,
         acceptance_rate = EXCLUDED.acceptance_rate`,
      [
        problem.slug,
        problem.title,
        problem.difficulty,
        problem.description,
        JSON.stringify(problem.examples),
        JSON.stringify(problem.constraints),
        JSON.stringify(problem.starterCode),
        JSON.stringify(problem.testCases),
        problem.tags,
        problem.acceptanceRate,
      ]
    );
    console.log(`  ✓ ${problem.title}`);
  }

  console.log(`Seeded ${problems.length} problems.`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
