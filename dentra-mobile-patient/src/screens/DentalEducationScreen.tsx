import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import {
  EDUCATION,
  EDUCATION_DISCLAIMER,
  findEducationArticle,
} from '@/content/dental-education';
import { EducationArticleCard } from '@/components/education/education-article-card';
import { Card, Empty, Field, Screen, Section } from '@/components/ui';
import type { PatientScreenProps } from '@/navigation/types';
import { colors, ui } from '@/theme';

const categoryLabels: Record<string, string> = {
  conditions: 'Conditions',
  hygiene: 'Daily care',
  prevention: 'Prevention',
  treatments: 'Treatments',
  'when-to-seek-care': 'When to seek care',
};

export function DentalEducationScreen({
  navigation,
}: PatientScreenProps<'DentalEducation'>) {
  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');
  const term = search.trim().toLocaleLowerCase();
  const urgent = findEducationArticle('urgent-care')?.article;
  const showUrgentFirst = !term && categoryId === 'all';
  const groups = EDUCATION.filter(
    category => categoryId === 'all' || category.id === categoryId,
  )
    .map(category => ({
      ...category,
      articles: category.articles.filter(
        article =>
          !(showUrgentFirst && article.id === urgent?.id) &&
          [
            article.title,
            article.summary,
            ...article.body,
            ...(article.points ?? []),
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(term),
      ),
    }))
    .filter(category => category.articles.length > 0);
  const categories = [{ id: 'all', title: 'All topics' }, ...EDUCATION];
  return (
    <Screen title="Dental education" onBack={navigation.goBack}>
      <Card style={styles.intro}>
        <BookOpen size={28} color={colors.accent} />
        <Text style={ui.title}>Understand your smile</Text>
        <Text style={ui.muted}>
          Explore dental conditions, daily habits and what to expect from common
          treatments.
        </Text>
      </Card>
      <Field
        label="Find a topic"
        accessibilityLabel="Search dental education"
        placeholder="Search brushing, cavities, gums…"
        value={search}
        onChangeText={setSearch}
        maxLength={100}
        autoCorrect={false}
        returnKeyType="search"
      />
      <ScrollView
        horizontal
        style={styles.categoryScroll}
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {categories.map(category => (
          <Pressable
            key={category.id}
            accessibilityRole="tab"
            accessibilityLabel={
              category.id === 'all'
                ? 'All topics'
                : `${categoryLabels[category.id] ?? category.title} topics`
            }
            accessibilityState={{ selected: categoryId === category.id }}
            onPress={() => {
              setCategoryId(category.id);
              setSearch('');
            }}
            style={[styles.chip, categoryId === category.id && styles.selected]}
          >
            <Text
              style={[
                styles.chipText,
                categoryId === category.id && styles.selectedText,
              ]}
            >
              {categoryLabels[category.id] ?? category.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {showUrgentFirst && urgent && (
        <EducationArticleCard
          article={urgent}
          onPress={() =>
            navigation.navigate('EducationArticle', { articleId: urgent.id })
          }
        />
      )}
      {groups.map(category => (
        <Section key={category.id} title={category.title}>
          <Text style={ui.muted}>{category.description}</Text>
          {category.articles.map(article => (
            <EducationArticleCard
              key={article.id}
              article={article}
              onPress={() =>
                navigation.navigate('EducationArticle', {
                  articleId: article.id,
                })
              }
            />
          ))}
        </Section>
      ))}
      {!groups.length && (
        <Empty
          icon={BookOpen}
          title="No topics found"
          message="Try another word or choose a different category."
        />
      )}
      <View style={styles.notice}>
        <Text style={ui.small}>{EDUCATION_DISCLAIMER}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  categoryScroll: { flexGrow: 0, flexShrink: 0 },
  categories: { gap: 8, paddingVertical: 2, alignItems: 'center' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.soft,
    minHeight: 44,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accent },
  chipText: {
    ...ui.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentDeep,
  },
  selectedText: { color: colors.surface },
  notice: { paddingVertical: 8 },
});
